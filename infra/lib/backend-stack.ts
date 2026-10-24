import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigw from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpIamAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AccessLogFormat } from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as chatbot from 'aws-cdk-lib/aws-chatbot';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ivs from 'aws-cdk-lib/aws-ivs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rum from 'aws-cdk-lib/aws-rum';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import * as targets from 'aws-cdk-lib/aws-scheduler-targets';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { routes } from '../../backend/src/routes';

// Browser origins allowed to call the API and fetch replays. Add the Vercel domain once the frontend is live.
const ALLOWED_ORIGINS = ['http://localhost:3000', 'https://pitchdrill-azure.vercel.app'];
// OpenRouter model for briefs (chosen by the user, 2026-10-15).
const OPENROUTER_MODEL = 'anthropic/claude-haiku-5.5';

// Slack channel for alarm notifications via AWS Chatbot. The workspace must first be authorized once in the
// Chatbot console (an OAuth click; there is no API for it). Until both IDs are set, alarms only go to the SNS topic.
const SLACK_WORKSPACE_ID = 'T09F859DKKN'; // WillItWork
const SLACK_CHANNEL_ID = 'C0CBN0HLGJ1';

const pascal = (name: string) => `${name[0]!.toUpperCase()}${name.slice(1)}`;

export class PitchDrillBackendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ======================
    // 1. DATA LAYER
    // ======================

    // Single table; layout in docs/system_specs/data_model.md. Production data: retained and deletion-protected.
    const table = new dynamodb.TableV2(this, 'PitchDrillMainTable', {
      tableName: 'pitchdrill-main',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      // Replay feed (GSI1PK = "REPLAY", GSI1SK = endedAt).
      globalSecondaryIndexes: [
        {
          indexName: 'GSI1',
          partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
          sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
          projectionType: dynamodb.ProjectionType.ALL,
        },
      ],
      // New round META items trigger brief generation.
      dynamoStream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    // Placeholder only; the real key is set out of band with `aws secretsmanager put-secret-value` (CLAUDE.md).
    const openRouterSecret = new secretsmanager.Secret(this, 'PitchDrillOpenRouterSecret', {
      secretName: 'pitchdrill/openrouter-api-key',
      secretStringValue: cdk.SecretValue.unsafePlainText('set-me'),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ======================
    // 2. MEDIA LAYER
    // ======================

    const recordings = new s3.Bucket(this, 'PitchDrillRecordingsBucket', {
      bucketName: `pitchdrill-recordings-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
    // IVS composite recording writes with its service principal. IVS adds this statement itself when the storage
    // configuration is created, but CloudFormation owns the bucket policy and would drop it on the next update,
    // so it is declared here. https://docs.aws.amazon.com/ivs/latest/RealTimeUserGuide/rt-composite-recording.html
    recordings.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: 'IvsCompositeWrite',
        principals: [new iam.ServicePrincipal(`ivs-composite.${this.region}.amazonaws.com`)],
        actions: ['s3:PutObject', 's3:PutObjectAcl'],
        resources: [recordings.arnForObjects('*')],
        conditions: {
          StringEquals: { 's3:x-amz-acl': 'bucket-owner-full-control', 'aws:SourceAccount': this.account },
          Bool: { 'aws:SecureTransport': 'true' },
        },
      }),
    );

    // Replays are served through CloudFront with Origin Access Control; the bucket stays private.
    const replayCors = new cloudfront.ResponseHeadersPolicy(this, 'PitchDrillReplayCorsPolicy', {
      responseHeadersPolicyName: 'pitchdrill-replay-cors',
      corsBehavior: {
        accessControlAllowOrigins: ALLOWED_ORIGINS,
        accessControlAllowMethods: ['GET', 'HEAD'],
        accessControlAllowHeaders: ['*'],
        accessControlAllowCredentials: false,
        originOverride: true,
      },
    });
    const cdn = new cloudfront.Distribution(this, 'PitchDrillRecordingsCdn', {
      comment: 'PitchDrill replay videos',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(recordings),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.HTTPS_ONLY,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        responseHeadersPolicy: replayCors,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    const encoder = new ivs.CfnEncoderConfiguration(this, 'PitchDrillCompositeEncoder', {
      name: 'pitchdrill-composite',
      video: { width: 1280, height: 720, framerate: 30, bitrate: 2_500_000 },
    });
    const storage = new ivs.CfnStorageConfiguration(this, 'PitchDrillRecordingsStorage', {
      name: 'pitchdrill-recordings',
      s3: { bucketName: recordings.bucketName },
    });
    // IVS validates its write access when the storage configuration is created.
    if (recordings.policy) storage.node.addDependency(recordings.policy);

    // ======================
    // 3. COMPUTE LAYER
    // ======================

    // Handlers are bundled by `bun run build` in backend/ (cdk.json runs it before synth).
    const code = lambda.Code.fromAsset(path.join(__dirname, '../../backend/dist'));
    const logGroups: Record<string, logs.LogGroup> = {};

    const makeFunction = (name: string, opts: { timeout?: cdk.Duration; memorySize?: number; environment?: Record<string, string> } = {}) => {
      const logGroup = new logs.LogGroup(this, `PitchDrill${name}Logs`, {
        logGroupName: `/aws/lambda/PitchDrill${name}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      });
      logGroups[name] = logGroup;
      return new lambda.Function(this, `PitchDrill${name}`, {
        functionName: `PitchDrill${name}`,
        runtime: lambda.Runtime.NODEJS_24_X,
        architecture: lambda.Architecture.ARM_64,
        code,
        handler: `${name[0]!.toLowerCase()}${name.slice(1)}.handler`,
        memorySize: opts.memorySize ?? 256,
        timeout: opts.timeout ?? cdk.Duration.seconds(10),
        tracing: lambda.Tracing.ACTIVE,
        logGroup,
        environment: { TABLE_NAME_ENV: table.tableName, ...opts.environment },
      });
    };

    // IVS has no CDK grant methods: scoped role policies on exact actions and resource types.
    const ivsArn = (resource: string) => this.formatArn({ service: 'ivs', resource, resourceName: '*' });
    const roomArn = this.formatArn({ service: 'ivschat', resource: 'room', resourceName: '*' });
    const allow = (fn: lambda.IFunction, actions: string[], resources: string[]) =>
      fn.addToRolePolicy(new iam.PolicyStatement({ actions, resources }));
    const ivsPolicies = {
      stageToken: (fn: lambda.IFunction) => allow(fn, ['ivs:CreateParticipantToken'], [ivsArn('stage')]),
      chatToken: (fn: lambda.IFunction) => allow(fn, ['ivschat:CreateChatToken'], [roomArn]),
      sendEvent: (fn: lambda.IFunction) => allow(fn, ['ivschat:SendEvent'], [roomArn]),
      endRound: (fn: lambda.IFunction) => {
        allow(fn, ['ivs:StopComposition'], [ivsArn('composition')]);
        allow(fn, ['ivs:DeleteStage'], [ivsArn('stage')]);
        allow(fn, ['ivschat:SendEvent', 'ivschat:DeleteRoom'], [roomArn]);
      },
    };

    // API handlers: one Lambda per route in backend/src/routes.ts. Grants are per function and explicit.
    const apiEnv = { RECORDINGS_CDN_DOMAIN_ENV: cdn.distributionDomainName };
    const fns: Record<string, lambda.Function> = {};
    for (const route of routes) fns[route.handler] = makeFunction(pascal(route.handler), { environment: apiEnv });

    const readers = ['listSlots', 'getTicket', 'listLiveRounds', 'getRound', 'getBrief', 'joinRound', 'watchRound', 'createChatToken', 'listReplays', 'listComments', 'adminListReports'];
    const writers = ['createBooking', 'castVote', 'createComment', 'createReport', 'adminEndRound', 'adminHideRound'];
    readers.forEach((h) => table.grantReadData(fns[h]!));
    writers.forEach((h) => table.grantReadWriteData(fns[h]!));
    ivsPolicies.stageToken(fns.joinRound!);
    ivsPolicies.chatToken(fns.joinRound!);
    ivsPolicies.stageToken(fns.watchRound!);
    ivsPolicies.chatToken(fns.createChatToken!);
    ivsPolicies.sendEvent(fns.castVote!);
    ivsPolicies.endRound(fns.adminEndRound!);

    // Contact form: emails the owner from and to one SES-verified address. The address lives only in SSM
    // (`/pitchdrill/contact-email`, set with the CLI) and is resolved by CloudFormation at deploy, so it is never in Git.
    // SES emails that address a verification link on first deploy; sending works once it is clicked (sandbox is fine).
    const contactEmail = ssm.StringParameter.valueForStringParameter(this, '/pitchdrill/contact-email');
    const contactIdentity = new ses.EmailIdentity(this, 'PitchDrillContactEmailIdentity', { identity: ses.Identity.email(contactEmail) });
    contactIdentity.grantSendEmail(fns.createContact!);
    fns.createContact!.addEnvironment('CONTACT_EMAIL_ENV', contactEmail);

    // SlotTick drives every round through its lifecycle (docs/system_specs/architecture.md §4).
    // ponytail: no reserved concurrency (account limit is 10); overlapping ticks are safe because every transition is conditional.
    // 90 s: the tick before a slot waits for T and polls up to 50 s for both players (lifecycle.ts START_POLL).
    const slotTick = makeFunction('SlotTick', {
      timeout: cdk.Duration.seconds(90),
      memorySize: 512,
      environment: {
        OPENROUTER_SECRET_ARN_ENV: openRouterSecret.secretArn,
        OPENROUTER_MODEL_ENV: OPENROUTER_MODEL,
        STORAGE_CONFIGURATION_ARN_ENV: storage.attrArn,
        ENCODER_CONFIGURATION_ARN_ENV: encoder.attrArn,
        RECORDINGS_BUCKET_ENV: recordings.bucketName,
      },
    });
    table.grantReadWriteData(slotTick);
    openRouterSecret.grantRead(slotTick);
    recordings.grantRead(slotTick);
    allow(slotTick, ['ivs:CreateStage', 'ivs:DeleteStage', 'ivs:GetStage', 'ivs:ListParticipants', 'ivs:TagResource'], [ivsArn('stage')]);
    allow(slotTick, ['ivs:StartComposition', 'ivs:StopComposition', 'ivs:TagResource'], [ivsArn('composition'), ivsArn('stage'), encoder.attrArn, storage.attrArn]);
    allow(slotTick, ['ivschat:CreateRoom', 'ivschat:DeleteRoom', 'ivschat:SendEvent', 'ivschat:TagResource'], [roomArn]);

    new scheduler.Schedule(this, 'PitchDrillSlotTickSchedule', {
      scheduleName: 'pitchdrill-slot-tick',
      description: 'Every minute during slot hours (4:00–8:45 PM Pacific slots, with margin either side).',
      schedule: scheduler.ScheduleExpression.cron({ minute: '*', hour: '15-21', timeZone: cdk.TimeZone.AMERICA_LOS_ANGELES }),
      target: new targets.LambdaInvoke(slotTick, { retryAttempts: 0 }),
    });

    // GenerateBriefs: new round META → OpenRouter brief. Failures are logged; SlotTick retries/falls back at T-5m.
    const generateBriefs = makeFunction('GenerateBriefs', {
      timeout: cdk.Duration.seconds(60),
      environment: { OPENROUTER_SECRET_ARN_ENV: openRouterSecret.secretArn, OPENROUTER_MODEL_ENV: OPENROUTER_MODEL },
    });
    table.grantWriteData(generateBriefs);
    openRouterSecret.grantRead(generateBriefs);
    generateBriefs.addEventSource(
      new DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        retryAttempts: 0,
        filters: [lambda.FilterCriteria.filter({ eventName: lambda.FilterRule.isEqual('INSERT'), dynamodb: { Keys: { SK: { S: lambda.FilterRule.isEqual('META') } } } })],
      }),
    );

    // ======================
    // 4. API LAYER
    // ======================

    // Public routes have no authorizer (throttles are the abuse limit); admin routes need IAM (SigV4) forever.
    const api = new apigw.HttpApi(this, 'PitchDrillApi', {
      apiName: 'pitchdrill-api',
      createDefaultStage: false,
      corsPreflight: {
        allowOrigins: ALLOWED_ORIGINS,
        allowMethods: [apigw.CorsHttpMethod.GET, apigw.CorsHttpMethod.POST],
        allowHeaders: ['content-type', 'x-ticket'],
        maxAge: cdk.Duration.minutes(5),
      },
    });

    const apiRoutes = routes.flatMap((route) =>
      api.addRoutes({
        path: route.path,
        methods: [route.method === 'GET' ? apigw.HttpMethod.GET : apigw.HttpMethod.POST],
        integration: new HttpLambdaIntegration(`PitchDrill${pascal(route.handler)}Integration`, fns[route.handler]!),
        ...(route.auth === 'iam' && { authorizer: new HttpIamAuthorizer() }),
      }),
    );

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
    // routeSettings is a raw JSON map, so keys use CloudFormation PascalCase. Routes must exist first.
    cfnStage.routeSettings = Object.fromEntries(
      routes
        .filter((r) => r.throttle)
        .map((r) => [`${r.method} ${r.path}`, { ThrottlingRateLimit: r.throttle!.rateLimit, ThrottlingBurstLimit: r.throttle!.burstLimit }]),
    );
    apiRoutes.forEach((route) => cfnStage.node.addDependency(route));

    // ======================
    // 5. MONITORING
    // ======================

    // Unhandled errors are logged at ERROR by backend/src/lib/http.ts (and lifecycle.ts) and returned as 500s.
    const errorLogsAlarm = (id: string, alarmName: string, logGroup: logs.LogGroup, description: string) => {
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

    errorLogsAlarm(
      'PitchDrillUsersCannotSeeScheduleAlarm',
      'pitchdrill-users-cannot-see-schedule',
      logGroups.ListSlots!,
      'Visitors cannot load the list of bookable slots, so nobody can start a booking. ' +
        'Check ERROR lines in the PitchDrillListSlots log group and recent deploys.',
    );
    errorLogsAlarm(
      'PitchDrillUsersCannotBookAlarm',
      'pitchdrill-users-cannot-book',
      logGroups.CreateBooking!,
      'People are failing to book seller/buyer seats. Check ERROR lines in the PitchDrillCreateBooking ' +
        'log group, DynamoDB throttling on pitchdrill-main, and recent deploys.',
    );
    errorLogsAlarm(
      'PitchDrillUsersCannotOpenTicketsAlarm',
      'pitchdrill-users-cannot-open-tickets',
      logGroups.GetTicket!,
      'People with valid ticket links cannot load their booking, so they cannot reach their round. ' +
        'Check ERROR lines in the PitchDrillGetTicket log group and DynamoDB health.',
    );
    errorLogsAlarm(
      'PitchDrillUsersCannotJoinRoundsAlarm',
      'pitchdrill-users-cannot-join-rounds',
      logGroups.JoinRound!,
      'Sellers or buyers cannot get on camera for their round, so rounds will be cancelled as no-shows. ' +
        'Check ERROR lines in PitchDrillJoinRound (IVS CreateParticipantToken / CreateChatToken permissions or limits).',
    );
    errorLogsAlarm(
      'PitchDrillUsersCannotVoteAlarm',
      'pitchdrill-users-cannot-vote',
      logGroups.CastVote!,
      'Spectators cannot vote Sold / Not sold after the buzzer. Check ERROR lines in PitchDrillCastVote and DynamoDB health.',
    );
    errorLogsAlarm(
      'PitchDrillRoundsNotStartingAlarm',
      'pitchdrill-rounds-not-starting',
      logGroups.SlotTick!,
      'Rounds may not open, start, end or be recorded on time: SlotTick logged errors. ' +
        'Check ERROR lines in PitchDrillSlotTick (IVS stage/room/composition calls, DynamoDB).',
    );
    new cloudwatch.Alarm(this, 'PitchDrillRoundsUsingFallbackBriefsAlarm', {
      alarmName: 'pitchdrill-rounds-using-fallback-briefs',
      alarmDescription:
        'Players are getting canned product briefs instead of fresh ones: OpenRouter generation keeps failing. ' +
        'Check WARN lines in PitchDrillGenerateBriefs / PitchDrillSlotTick, the OpenRouter key in Secrets Manager and OpenRouter credit.',
      metric: new cloudwatch.Metric({
        namespace: 'PitchDrill',
        metricName: 'BriefFallbackUsed',
        dimensionsMap: { service: 'pitchdrill' },
        statistic: 'Sum',
        period: cdk.Duration.hours(1),
      }),
      threshold: 3,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
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

    // Lambda crashes and timeouts never reach the ERROR log filters above ("Task timed out" is plain text), and the
    // two non-API Lambdas have no 5xx alarm behind them.
    new cloudwatch.Alarm(this, 'PitchDrillRoundsStalledAlarm', {
      alarmName: 'pitchdrill-rounds-stalled',
      alarmDescription:
        'SlotTick crashed or timed out, so rounds may not open, start, end or record on time. ' +
        'Check the PitchDrillSlotTick log group for "Task timed out" or a runtime error.',
      metric: slotTick.metricErrors({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, 'PitchDrillBriefsGeneratorCrashingAlarm', {
      alarmName: 'pitchdrill-briefs-generator-crashing',
      alarmDescription:
        'GenerateBriefs crashed or timed out, so new rounds wait for SlotTick to retry their briefs or fall back to canned ones. ' +
        'Check the PitchDrillGenerateBriefs log group for "Task timed out" or a runtime error.',
      metric: generateBriefs.metricErrors({ statistic: 'Sum', period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // CloudWatch RUM for the Vercel site (frontend/src/lib/rum.ts): browser errors, failed fetches, Web Vitals.
    // Browsers send events unsigned, allowed by the resource policy, so there is no Cognito identity pool; RUM
    // rejects events from any other domain. Events are kept 30 days in the RUM console.
    const RUM_APP_MONITOR = 'pitchdrill';
    const rumMonitor = new rum.CfnAppMonitor(this, 'PitchDrillRumAppMonitor', {
      name: RUM_APP_MONITOR,
      domainList: ['pitchdrill-azure.vercel.app'],
      appMonitorConfiguration: { allowCookies: true, enableXRay: false, sessionSampleRate: 1, telemetries: ['errors', 'http', 'performance'] },
      resourcePolicy: {
        policyDocument: this.toJsonString({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: '*',
              Action: 'rum:PutRumEvents',
              Resource: this.formatArn({ service: 'rum', resource: 'appmonitor', resourceName: RUM_APP_MONITOR }),
            },
          ],
        }),
      },
    });
    const rumMetric = (metricName: string) =>
      new cloudwatch.Metric({ namespace: 'AWS/RUM', metricName, dimensionsMap: { application_name: RUM_APP_MONITOR }, statistic: 'Sum', period: cdk.Duration.minutes(15) });
    new cloudwatch.Alarm(this, 'PitchDrillUsersHittingBrowserErrorsAlarm', {
      alarmName: 'pitchdrill-users-hitting-browser-errors',
      alarmDescription:
        'Visitors are hitting JavaScript errors in the browser (page crashes, IVS video or chat failing, mic unavailable). ' +
        'Open CloudWatch RUM → pitchdrill → Errors for the message, page and browser.',
      metric: rumMetric('JsErrorCount'),
      threshold: 5,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Every alarm (and its recovery) goes to one SNS topic; AWS Chatbot posts the topic to Slack.
    const alarms = this.node.findAll().filter((c): c is cloudwatch.Alarm => c instanceof cloudwatch.Alarm);
    const alertsTopic = new sns.Topic(this, 'PitchDrillAlertsTopic', { topicName: 'pitchdrill-alerts' });
    alarms.forEach((alarm) => {
      alarm.addAlarmAction(new cwActions.SnsAction(alertsTopic));
      alarm.addOkAction(new cwActions.SnsAction(alertsTopic));
    });
    if (SLACK_WORKSPACE_ID && SLACK_CHANNEL_ID) {
      new chatbot.SlackChannelConfiguration(this, 'PitchDrillSlackAlerts', {
        slackChannelConfigurationName: 'pitchdrill-alerts',
        slackWorkspaceId: SLACK_WORKSPACE_ID,
        slackChannelId: SLACK_CHANNEL_ID,
        notificationTopics: [alertsTopic],
        // Notifications only: anyone in the channel can at most read CloudWatch, never change anything.
        guardrailPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('CloudWatchReadOnlyAccess')],
      });
    }

    // One dashboard (CloudWatch's first 3 are free, up to 50 metrics each).
    const business = (metricName: string) =>
      new cloudwatch.Metric({ namespace: 'PitchDrill', metricName, dimensionsMap: { service: 'pitchdrill' }, statistic: 'Sum', period: cdk.Duration.minutes(15) });
    const graph = (title: string, left: cloudwatch.IMetric[], width = 8) => new cloudwatch.GraphWidget({ title, left, width, height: 6 });
    new cloudwatch.Dashboard(this, 'PitchDrillDashboard', {
      dashboardName: 'pitchdrill',
      defaultInterval: cdk.Duration.days(1),
      widgets: [
        [
          graph('Bookings and rounds (per 15 min)', ['BookingCreated', 'RoundPaired', 'RoundStarted', 'RoundCancelled'].map(business)),
          graph('Briefs (per 15 min)', ['BriefGenerated', 'BriefGenerationFailed', 'BriefFallbackUsed'].map(business)),
          graph('Votes, contact, recordings (per 15 min)', ['VoteCast', 'ContactSent', 'RecordingMissing'].map(business)),
        ],
        [
          graph('API requests and errors', [api.metricCount(), api.metricClientError(), api.metricServerError()].map((m) => m.with({ statistic: 'Sum', period: cdk.Duration.minutes(5) }))),
          graph('API latency (ms)', ['p50', 'p99'].map((statistic) => api.metricLatency({ statistic, period: cdk.Duration.minutes(5) }))),
          new cloudwatch.AlarmStatusWidget({ title: 'Alarms', alarms, width: 8, height: 6 }),
        ],
        [
          graph('Lambda errors', [...Object.values(fns), slotTick, generateBriefs].map((fn) => fn.metricErrors({ label: fn.node.id, period: cdk.Duration.minutes(5) })), 16),
          graph('Browser errors, RUM (per 15 min)', ['JsErrorCount', 'HttpErrorCount'].map(rumMetric)),
        ],
      ],
    });

    // ======================
    // 6. OUTPUTS
    // ======================

    new cdk.CfnOutput(this, 'PitchDrillApiUrlOutput', {
      value: api.apiEndpoint,
      exportName: 'PitchDrillApiUrl',
      description: 'Base URL for the frontend (NEXT_PUBLIC_API_URL)',
    });
    new cdk.CfnOutput(this, 'PitchDrillRumAppMonitorIdOutput', {
      value: rumMonitor.attrId,
      description: 'Vercel env NEXT_PUBLIC_RUM_APP_MONITOR_ID (production)',
    });
    new cdk.CfnOutput(this, 'PitchDrillRecordingsCdnDomainOutput', {
      value: cdn.distributionDomainName,
      exportName: 'PitchDrillRecordingsCdnDomain',
      description: 'CloudFront domain serving replay HLS',
    });
  }
}
