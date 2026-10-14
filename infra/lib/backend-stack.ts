import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpIamAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AccessLogFormat } from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as targets from 'aws-cdk-lib/aws-scheduler-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ivs from 'aws-cdk-lib/aws-ivs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { routes } from '../../backend/src/routes';

// Browser origins allowed to call the API. Add the Vercel domain once the frontend is deployed.
const ALLOWED_ORIGINS = ['http://localhost:3000'];

// OpenRouter model for briefs. Passed to Lambdas as OPENROUTER_MODEL_ENV (TASK-005).
const OPENROUTER_MODEL = 'anthropic/claude-haiku-5.5';

export class PitchDrillBackendStack extends cdk.Stack {
  /** Used by SlotTick to start compositions (TASK-007). */
  readonly encoderConfiguration: ivs.CfnEncoderConfiguration;
  readonly storageConfiguration: ivs.CfnStorageConfiguration;

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
      // GSI1 lists replays newest first; the stream triggers GenerateBriefs when a round is paired.
      globalSecondaryIndexes: [
        {
          indexName: 'GSI1',
          partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
          projectionType: dynamodb.ProjectionType.ALL,
        },
      ],
      dynamoStream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // Placeholder only; the real key is set out of band (aws secretsmanager put-secret-value) so it never enters Git.
    const openRouterSecret = new secretsmanager.Secret(this, 'PitchDrillOpenRouterSecret', {
      secretName: 'pitchdrill/openrouter-api-key',
      secretStringValue: cdk.SecretValue.unsafePlainText('set-me'),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ======================
    // 2. COMPUTE LAYER
    // ======================

    // Handlers are bundled by `bun run build` in backend/ (cdk.json runs it before synth).
    const code = lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist'));

    const makeFunction = (
      name: string,
      opts: { timeout?: cdk.Duration; memorySize?: number; reservedConcurrentExecutions?: number; environment?: Record<string, string> } = {},
    ) => {
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
        memorySize: opts.memorySize ?? 256,
        reservedConcurrentExecutions: opts.reservedConcurrentExecutions,
        timeout: opts.timeout ?? cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        logGroup,
        environment: { TABLE_NAME_ENV: table.tableName, ...opts.environment },
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
      listLiveRounds: 'read',
      getRound: 'read',
      getBrief: 'read',
      joinRound: 'read',
      watchRound: 'read',
      createChatToken: 'read',
      castVote: 'readWrite',
      listReplays: 'read',
      listComments: 'read',
      createComment: 'readWrite',
    };
    for (const [handler, { fn }] of Object.entries(fns)) {
      const grant = tableGrants[handler];
      if (grant === 'readWrite') table.grantReadWriteData(fn);
      else if (grant === 'read') table.grantReadData(fn);
      else throw new Error(`No table grant declared for handler "${handler}"`);
    }

    // IVS has no CDK grant methods: token minting only, on exact resource types.
    const stageArns = [this.formatArn({ service: 'ivs', resource: 'stage', resourceName: '*' })];
    for (const handler of ['joinRound', 'watchRound']) {
      fns[handler]!.fn.addToRolePolicy(new iam.PolicyStatement({ actions: ['ivs:CreateParticipantToken'], resources: stageArns }));
    }
    const roomArns = [this.formatArn({ service: 'ivschat', resource: 'room', resourceName: '*' })];
    for (const handler of ['joinRound', 'createChatToken']) {
      fns[handler]!.fn.addToRolePolicy(new iam.PolicyStatement({ actions: ['ivschat:CreateChatToken'], resources: roomArns }));
    }
    // castVote broadcasts the new tally to the round's chat room.
    fns.castVote!.fn.addToRolePolicy(new iam.PolicyStatement({ actions: ['ivschat:SendEvent'], resources: roomArns }));

    // Not an API route: triggered by the table stream for each new round META item.
    const generateBriefs = makeFunction('GenerateBriefs', {
      timeout: cdk.Duration.seconds(60),
      environment: { OPENROUTER_SECRET_ARN_ENV: openRouterSecret.secretArn, OPENROUTER_MODEL_ENV: OPENROUTER_MODEL },
    });
    openRouterSecret.grantRead(generateBriefs.fn);
    table.grantWriteData(generateBriefs.fn);
    generateBriefs.fn.addEventSource(
      new DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 0,
        filters: [
          lambda.FilterCriteria.filter({
            eventName: lambda.FilterRule.isEqual('INSERT'),
            dynamodb: { Keys: { SK: { S: lambda.FilterRule.isEqual('META') } } },
          }),
        ],
      }),
    );

    // Drives every round through its lifecycle. One execution at a time; a throttled invoke is skipped and the next minute catches up.
    const slotTick = makeFunction('SlotTick', {
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      reservedConcurrentExecutions: 1,
      environment: { OPENROUTER_SECRET_ARN_ENV: openRouterSecret.secretArn, OPENROUTER_MODEL_ENV: OPENROUTER_MODEL },
    });
    table.grantReadWriteData(slotTick.fn);
    openRouterSecret.grantRead(slotTick.fn);
    // IVS has no CDK grant methods: scope to the exact actions and resource types SlotTick uses.
    slotTick.fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ivs:CreateStage', 'ivs:DeleteStage', 'ivs:TagResource', 'ivs:GetStage', 'ivs:ListParticipants', 'ivs:StartComposition'],
        resources: [this.formatArn({ service: 'ivs', resource: 'stage', resourceName: '*' })],
      }),
    );
    slotTick.fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ivschat:CreateRoom', 'ivschat:DeleteRoom', 'ivschat:TagResource', 'ivschat:SendEvent'],
        resources: [this.formatArn({ service: 'ivschat', resource: 'room', resourceName: '*' })],
      }),
    );
    new scheduler.Schedule(this, 'PitchDrillSlotTickSchedule', {
      scheduleName: 'pitchdrill-slot-tick',
      schedule: scheduler.ScheduleExpression.cron({
        minute: '*',
        hour: '15-21',
        timeZone: cdk.TimeZone.AMERICA_LOS_ANGELES,
      }),
      target: new targets.LambdaInvoke(slotTick.fn, { retryAttempts: 0 }),
    });

    // ======================
    // 2b. MEDIA LAYER
    // ======================

    // Recordings: IVS server-side composition writes HLS here; CloudFront (OAC) is the only reader.
    const recordingsBucket = new s3.Bucket(this, 'PitchDrillRecordingsBucket', {
      bucketName: `pitchdrill-recordings-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // hls.js fetches playlists and segments cross-origin from the frontend.
    const recordingsCors = new cloudfront.ResponseHeadersPolicy(this, 'PitchDrillRecordingsCors', {
      corsBehavior: {
        accessControlAllowOrigins: ALLOWED_ORIGINS,
        accessControlAllowMethods: ['GET', 'HEAD'],
        accessControlAllowHeaders: ['*'],
        accessControlAllowCredentials: false,
        originOverride: true,
      },
    });
    const recordingsCdn = new cloudfront.Distribution(this, 'PitchDrillRecordingsCdn', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(recordingsBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        responseHeadersPolicy: recordingsCors,
      },
    });

    for (const handler of ['getRound', 'listLiveRounds', 'listReplays']) {
      fns[handler]!.fn.addEnvironment('RECORDINGS_CDN_DOMAIN_ENV', recordingsCdn.distributionDomainName);
    }

    this.encoderConfiguration = new ivs.CfnEncoderConfiguration(this, 'PitchDrillCompositeEncoder', {
      name: 'pitchdrill-composite',
      video: { width: 1280, height: 720, framerate: 30, bitrate: 2_500_000 },
    });
    this.storageConfiguration = new ivs.CfnStorageConfiguration(this, 'PitchDrillRecordingsStorage', {
      name: 'pitchdrill-recordings',
      s3: { bucketName: recordingsBucket.bucketName },
    });
    // SlotTick starts compositions: it needs the configuration ARNs and StartComposition on them too.
    slotTick.fn.addEnvironment('STORAGE_CONFIGURATION_ARN_ENV', this.storageConfiguration.attrArn);
    slotTick.fn.addEnvironment('ENCODER_CONFIGURATION_ARN_ENV', this.encoderConfiguration.attrArn);
    slotTick.fn.addToRolePolicy(
      // IVS has no CDK grant methods.
      new iam.PolicyStatement({
        actions: ['ivs:StartComposition'],
        resources: [this.storageConfiguration.attrArn, this.encoderConfiguration.attrArn],
      }),
    );
    // SlotTick looks for finished recordings in the bucket and stops compositions at the buzzer.
    recordingsBucket.grantRead(slotTick.fn);
    slotTick.fn.addEnvironment('RECORDINGS_BUCKET_ENV', recordingsBucket.bucketName);
    slotTick.fn.addToRolePolicy(
      // IVS has no CDK grant methods.
      new iam.PolicyStatement({
        actions: ['ivs:StopComposition'],
        resources: [this.formatArn({ service: 'ivs', resource: 'composition', resourceName: '*' })],
      }),
    );
    // No bucket policy for IVS: composition output is written through the IVS service-linked role,
    // which IVS creates on first use. ponytail: confirm against the IVS real-time composition S3 docs
    // when deploying; if writes are denied, add a bucket resource policy here (bucket.addToResourcePolicy).

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
    unhandledErrorsAlarm(
      'PitchDrillRoundsNotStartingAlarm',
      'pitchdrill-rounds-not-starting',
      slotTick.logGroup,
      'Scheduled rounds may not open or start, so booked people will not get their stage. ' +
        'Check ERROR lines in the PitchDrillSlotTick log group, IVS service health and recent deploys.',
    );
    new cloudwatch.Alarm(this, 'PitchDrillRoundsUsingFallbackBriefsAlarm', {
      alarmName: 'pitchdrill-rounds-using-fallback-briefs',
      alarmDescription:
        'Rounds are starting with the built-in fallback products because OpenRouter briefs failed. ' +
        'Check the OpenRouter key in Secrets Manager, the model ID and OpenRouter status.',
      metric: new cloudwatch.Metric({
        namespace: 'PitchDrill',
        metricName: 'BriefFallbackUsed',
        dimensionsMap: { service: 'pitchdrill' }, // Powertools adds the service dimension to every metric
        statistic: 'Sum',
        period: cdk.Duration.hours(1),
      }),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    unhandledErrorsAlarm(
      'PitchDrillUsersCannotJoinRoundsAlarm',
      'pitchdrill-users-cannot-join-rounds',
      fns.joinRound!.logGroup,
      'Booked sellers and buyers cannot get their stage token, so their round cannot start. ' +
        'Check ERROR lines in the PitchDrillJoinRound log group, IVS service health and recent deploys.',
    );
    unhandledErrorsAlarm(
      'PitchDrillUsersCannotVoteAlarm',
      'pitchdrill-users-cannot-vote',
      fns.castVote!.logGroup,
      'Spectators cannot cast Sold / Not sold votes. ' +
        'Check ERROR lines in the PitchDrillCastVote log group, DynamoDB throttling on pitchdrill-main and recent deploys.',
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

    new cdk.CfnOutput(this, 'PitchDrillRecordingsCdnDomainOutput', {
      value: recordingsCdn.distributionDomainName,
      exportName: 'PitchDrillRecordingsCdnDomain',
      description: 'CloudFront domain serving replay recordings',
    });
  }
}
