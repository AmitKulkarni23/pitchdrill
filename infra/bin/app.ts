import * as cdk from 'aws-cdk-lib';
import { PitchDrillBackendStack } from '../lib/backend-stack';

const app = new cdk.App();

// Production only. Account comes from the active AWS profile; never hardcoded.
new PitchDrillBackendStack(app, 'PitchDrillBackendStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-west-2' },
});
