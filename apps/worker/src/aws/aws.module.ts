/**
 * AWS module — providers for SQS / S3 / KMS clients, the worker config, and
 * the EncryptionModule (ALE — depends on KMS + admin Prisma for the dek
 * store).
 *
 * Endpoint + credentials are read from `WorkerConfig`. In dev that points at
 * LocalStack; in real AWS the endpoint is undefined and credentials come from
 * the IRSA-injected provider chain.
 */

import {
  createEncryptionModule,
  createPrismaDekStore,
  type EncryptionModule,
} from "@aims/encryption";
import { type AdminPrismaClient } from "@aims/prisma-client";
import { KMSClient } from "@aws-sdk/client-kms";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { Module } from "@nestjs/common";

import { loadConfig, type WorkerConfig } from "../config";
import { ADMIN_PRISMA, DbModule } from "../db/db.module";

export const SQS_CLIENT = "SQS_CLIENT";
export const S3_CLIENT = "S3_CLIENT";
export const KMS_CLIENT = "KMS_CLIENT";
export const ENCRYPTION_MODULE = "ENCRYPTION_MODULE";
export const WORKER_CONFIG = "WORKER_CONFIG";

@Module({
  imports: [DbModule],
  providers: [
    { provide: WORKER_CONFIG, useFactory: () => loadConfig() },
    {
      provide: SQS_CLIENT,
      inject: [WORKER_CONFIG],
      useFactory: (config: WorkerConfig) =>
        new SQSClient({
          region: config.awsRegion,
          ...(config.awsEndpointUrl ? { endpoint: config.awsEndpointUrl } : {}),
          credentials: { accessKeyId: "test", secretAccessKey: "test" },
        }),
    },
    {
      provide: S3_CLIENT,
      inject: [WORKER_CONFIG],
      useFactory: (config: WorkerConfig) =>
        new S3Client({
          region: config.awsRegion,
          ...(config.awsEndpointUrl ? { endpoint: config.awsEndpointUrl } : {}),
          credentials: { accessKeyId: "test", secretAccessKey: "test" },
          forcePathStyle: true,
        }),
    },
    {
      provide: KMS_CLIENT,
      inject: [WORKER_CONFIG],
      useFactory: (config: WorkerConfig) =>
        new KMSClient({
          region: config.awsRegion,
          ...(config.awsEndpointUrl ? { endpoint: config.awsEndpointUrl } : {}),
          credentials: { accessKeyId: "test", secretAccessKey: "test" },
        }),
    },
    {
      provide: ENCRYPTION_MODULE,
      inject: [KMS_CLIENT, WORKER_CONFIG, ADMIN_PRISMA],
      useFactory: (
        kmsClient: KMSClient,
        config: WorkerConfig,
        prisma: AdminPrismaClient,
      ): EncryptionModule =>
        createEncryptionModule({
          kmsClient,
          masterKeyArn: config.kmsMasterKeyAlias,
          dekStore: createPrismaDekStore(prisma),
        }),
    },
  ],
  exports: [
    SQS_CLIENT,
    S3_CLIENT,
    KMS_CLIENT,
    ENCRYPTION_MODULE,
    WORKER_CONFIG,
  ],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- NestJS module marker
export class AwsModule {}
