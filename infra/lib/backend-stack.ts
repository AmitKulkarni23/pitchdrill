import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpIamAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AccessLogFormat } from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { routes } from '../../backend/src/routes';

// Browser origins allowed to call the API. Add the Vercel domain once the frontend is deployed.
const ALLOWED_ORIGINS = ['http://localhost:3000'];

export class PitchDrillBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ======================
    // 1. DATA LAYER
    // ======================

    // Single table; key layout in docs/architecture.md. Production data: retained and deletion-protected.
    const table = new dynamodb.TableV2(this, 'PitchDrillMainTable', {
      tableName: 'pitchdrill-main',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ======================
    // 2. COMPUTE LAYER
    // ======================

    // Handlers are bundled by `bun run build` in backend/ (cdk.json runs it before synth).
    const code = lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist'));

    const makeFunction = (name: string) => {
      const logGroup = new logs.LogGroup(this, `PitchDrill${name}Logs`, {
        logGroupName: `/aws/lambda/PitchDrill${name}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
      const fn = new lambda.Function(this, `PitchDrill${name}`, {
        functionName: `PitchDrill${name}`,
        runtime: lambda.Runtime.NODEJS_24_X,
        architecture: lambda.Architecture.ARM_64,
        code,
        handler: `${name[0]!.toLowerCase()}${name.slice(1)}.handler`,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        logGroup,
        environment: { TABLE_NAME_ENV: table.tableName },
      });
      return { fn, logGroup };
    };

    // One function per distinct handler in the route registry; "createBooking" -> "CreateBooking".
    const fns: Record<string, ReturnType<typeof makeFunction>> = {};
    for (const handler of new Set(routes.map((r) => r.handler))) {
      fns[handler] = makeFunction(`${handler[0]!.toUpperCase()}${handler.slice(1)}`);
    }

    // Least privilege: each function gets only the table access it needs.
    const tableGrants: Record<string, 'read' | 'readWrite'> = {
      listSlots: 'read',
      createBooking: 'readWrite',
      getTicket: 'read',
    };
    for (const [handler, { fn }] of Object.entries(fns)) {
      const grant = tableGrants[handler];
      if (grant === 'readWrite') table.grantReadWriteData(fn);
      else if (grant === 'read') table.grantReadData(fn);
      else throw new Error(`No table grant declared for handler "${handler}"`);
    }

    // ======================
    // 3. API LAYER
    // ======================

    const api = new apigw.HttpApi(this, 'PitchDrillApi', {
      apiName: 'pitchdrill-api',
      createDefaultStage: false,
      // Closed to the internet while testing: every route needs an IAM (SigV4) signed request.
      // Remove to open the public routes to browsers.
      defaultAuthorizer: new HttpIamAuthorizer(),
      corsPreflight: {
        allowOrigins: ALLOWED_ORIGINS,
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST],
        allowHeaders: ['content-type', 'x-ticket'],
        maxAge: cdk.Duration.minutes(5),
      },
    });

    const iamAuthorizer = new HttpIamAuthorizer();
    const apiRoutes = routes.flatMap((r) => {
      const name = `${r.handler[0]!.toUpperCase()}${r.handler.slice(1)}`;
      return api.addRoutes({
        path: r.path,
        methods: [apigw.HttpMethod[r.method]],
        integration: new HttpLambdaIntegration(`PitchDrill${name}Integration`, fns[r.handler]!.fn),
        ...(r.auth === 'iam' ? { authorizer: iamAuthorizer } : {}),
      });
    });

    const accessLogs = new logs.LogGroup(this, 'PitchDrillApiAccessLogs', {
      logGroupName: '/aws/apigateway/pitchdrill-api',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Throttles cap all users combined (HTTP APIs have no per-IP limits). Default applies to any route not listed.
    const stage = api.addStage('PitchDrillApiStage', {
      stageName: '$default',
      autoDeploy: true,
      throttle: { rateLimit: 50, burstLimit: 100 },
      accessLogSettings: {
        destination: new apigw.LogGroupLogDestination(accessLogs),
        format: AccessLogFormat.custom(
          JSON.stringify({
            requestId: '$context.requestId',
            time: '$context.requestTime',
            ip: '$context.identity.sourceIp',
            route: '$context.routeKey',
            status: '$context.status',
            latencyMs: '$context.responseLatency',
            integrationError: '$context.integrationErrorMessage',
          }),
        ),
      },
    });
    const cfnStage = stage.node.defaultChild as apigw.CfnStage;
    cfnStage.routeSettings = Object.fromEntries(
      routes
        .filter((r) => r.throttle)
        .map((r) => [
          `${r.method} ${r.path}`,
          { ThrottlingRateLimit: r.throttle!.rateLimit, ThrottlingBurstLimit: r.throttle!.burstLimit },
        ]),
    );
    // routeSettings is a raw JSON map, so keys use CloudFormation PascalCase. Routes must exist first.
    apiRoutes.forEach((route) => cfnStage.node.addDependency(route));

    // ======================
    // 4. MONITORING
    // ======================

    // Unhandled errors are logged at ERROR by backend/src/lib/http.ts and returned as 500s.
    const unhandledErrorsAlarm = (
      id: string,
      alarmName: string,
      logGroup: logs.LogGroup,
      description: string,
    ) => {
      const filter = new logs.MetricFilter(this, `${id}Filter`, {
        logGroup,
        filterPattern: logs.FilterPattern.stringValue('$.level', '=', 'ERROR'),
        metricNamespace: 'PitchDrill',
        metricName: `${id}UnhandledErrors`,
        metricValue: '1',
        defaultValue: 0,
      });
      new cloudwatch.Alarm(this, id, {
        alarmName,
        alarmDescription: description,
        metric: filter.metric({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
        threshold: 1,
        evaluationPeriods: 1,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      });
    };

    unhandledErrorsAlarm(
      'PitchDrillUsersCannotSeeScheduleAlarm',
      'pitchdrill-users-cannot-see-schedule',
      fns.listSlots!.logGroup,
      'Visitors cannot load the list of bookable slots, so nobody can start a booking. ' +
        'Check ERROR lines in the PitchDrillListSlots log group and recent deploys.',
    );
    unhandledErrorsAlarm(
      'PitchDrillUsersCannotBookAlarm',
      'pitchdrill-users-cannot-book',
      fns.createBooking!.logGroup,
      'People are failing to book seller/buyer seats. Check ERROR lines in the PitchDrillCreateBooking ' +
        'log group, DynamoDB throttling on pitchdrill-main, and recent deploys.',
    );
    unhandledErrorsAlarm(
      'PitchDrillUsersCannotOpenTicketsAlarm',
      'pitchdrill-users-cannot-open-tickets',
      fns.getTicket!.logGroup,
      'People with valid ticket links cannot load their booking, so they cannot reach their round. ' +
        'Check ERROR lines in the PitchDrillGetTicket log group and DynamoDB health.',
    );
    new cloudwatch.Alarm(this, 'PitchDrillUsersGettingServerErrorsAlarm', {
      alarmName: 'pitchdrill-users-getting-server-errors',
      alarmDescription:
        'Visitors are getting 5xx errors from the PitchDrill API (includes Lambda crashes and timeouts). ' +
        'Check /aws/apigateway/pitchdrill-api access logs for the failing route and integrationError.',
      metric: api.metricServerError({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // ======================
    // 5. OUTPUTS
    // ======================

    new cdk.CfnOutput(this, 'PitchDrillApiUrlOutput', {
      value: api.apiEndpoint,
      exportName: 'PitchDrillApiUrl',
      description: 'Base URL for the frontend (NEXT_PUBLIC_API_URL)',
    });
  }
}
