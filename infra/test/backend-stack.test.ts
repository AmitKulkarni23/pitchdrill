import { existsSync } from 'node:fs';
import * as path from 'node:path';
import { beforeAll, describe, expect, test } from 'bun:test';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { PitchDrillBackendStack } from '../lib/backend-stack';

const backend = path.join(__dirname, '../../backend');
let template: Template;

beforeAll(() => {
  // Code.fromAsset needs backend/dist to exist.
  if (!existsSync(path.join(backend, 'dist'))) {
    const build = Bun.spawnSync(['bun', 'run', 'build'], { cwd: backend });
    if (build.exitCode !== 0) throw new Error(`backend build failed: ${build.stderr}`);
  }
  const app = new cdk.App();
  const stack = new PitchDrillBackendStack(app, 'TestStack', { env: { account: '123456789012', region: 'us-west-2' } });
  template = Template.fromStack(stack);
});

describe('stack', () => {
  test('table should be retained with deletion protection', () => {
    template.hasResource('AWS::DynamoDB::GlobalTable', {
      DeletionPolicy: 'Retain',
      Properties: {
        TableName: 'pitchdrill-main',
        Replicas: [Match.objectLike({ DeletionProtectionEnabled: true })],
      },
    });
  });

  test('recordings bucket should block all public access and enforce SSL', () => {
    template.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      Properties: {
        BucketName: 'pitchdrill-recordings-123456789012',
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          BlockPublicPolicy: true,
          IgnorePublicAcls: true,
          RestrictPublicBuckets: true,
        },
        BucketEncryption: Match.objectLike({
          ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }],
        }),
      },
    });
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Effect: 'Deny', Condition: { Bool: { 'aws:SecureTransport': 'false' } } }),
        ]),
      },
    });
  });

  test('distribution should use origin access control', () => {
    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Origins: [Match.objectLike({ OriginAccessControlId: Match.anyValue(), S3OriginConfig: { OriginAccessIdentity: '' } })],
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
      }),
    });
  });

  test('distribution should send CORS headers for allowed origins', () => {
    template.hasResourceProperties('AWS::CloudFront::ResponseHeadersPolicy', {
      ResponseHeadersPolicyConfig: Match.objectLike({
        CorsConfig: Match.objectLike({
          AccessControlAllowOrigins: { Items: ['http://localhost:3000'] },
          AccessControlAllowMethods: { Items: ['GET', 'HEAD'] },
          OriginOverride: true,
        }),
      }),
    });
  });

  test('storage configuration should point at the recordings bucket', () => {
    template.hasResourceProperties('AWS::IVS::StorageConfiguration', {
      Name: 'pitchdrill-recordings',
      S3: { BucketName: Match.anyValue() },
    });
  });

  test('encoder configuration should be 720p30 at 2.5 Mbps', () => {
    template.hasResourceProperties('AWS::IVS::EncoderConfiguration', {
      Name: 'pitchdrill-composite',
      Video: { Width: 1280, Height: 720, Framerate: 30, Bitrate: 2500000 },
    });
  });

  test('should output the recordings CDN domain', () => {
    template.hasOutput('PitchDrillRecordingsCdnDomainOutput', { Export: { Name: 'PitchDrillRecordingsCdnDomain' } });
  });
});
