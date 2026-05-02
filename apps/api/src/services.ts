/**
 * Service container — created once at server startup, injected into the
 * tRPC context for every request.
 *
 * Services are long-lived singletons: the Prisma client, the encryption
 * module, the session module, the key pair. Per-request state (user,
 * session, tenant) lives in the tRPC context, not here.
 */

import { createEncryptionModule, createPrismaDekStore, type EncryptionModule } from "@aims/encryption";
import {
  createAdminPrismaClient,
  createTenantPrismaClient,
  type AdminPrismaClient,
  type TenantPrismaClient,
} from "@aims/prisma-client";
import { KMSClient } from "@aws-sdk/client-kms";
import { S3Client } from "@aws-sdk/client-s3";
import { type KeyLike } from "jose";

import { loadOrGenerateDevKeys } from "./auth/dev-keys";
import { createSessionModule, type SessionModule } from "./auth/session-lifecycle";
import { type Config } from "./config";

export type Services = {
  readonly config: Config;
  /** Admin client — no tenant extension. Use for auth/bootstrap only. */
  readonly prisma: AdminPrismaClient;
  /** Tenant-scoped client — reads/writes are auto-filtered by the active
   *  AsyncLocalStorage tenant context. Use inside authenticated procedures. */
  readonly prismaTenant: TenantPrismaClient;
  readonly kmsClient: KMSClient;
  readonly s3Client: S3Client;
  readonly encryption: EncryptionModule;
  readonly sessions: SessionModule;
  readonly publicKey: KeyLike;
  readonly privateKey: KeyLike;
};

export async function createServices(config: Config): Promise<Services> {
  // Admin connection (BYPASSRLS) for cross-tenant ops; tenant connection
  // (RLS-bound, scoped per-request via the Prisma extension) for everything
  // else. Per ADR-0002. If `databaseAdminUrl` is unset, the admin client
  // inherits DATABASE_URL — matches the test pattern where a single
  // superuser connection serves both clients.
  const prisma = createAdminPrismaClient(
    config.databaseAdminUrl
      ? { datasources: { db: { url: config.databaseAdminUrl } } }
      : undefined,
  );
  const prismaTenant = createTenantPrismaClient();

  const kmsClient = new KMSClient({
    region: config.awsRegion,
    ...(config.awsEndpointUrl ? { endpoint: config.awsEndpointUrl } : {}),
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });

  const s3Client = new S3Client({
    region: config.awsRegion,
    ...(config.awsEndpointUrl ? { endpoint: config.awsEndpointUrl } : {}),
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
    forcePathStyle: true,
  });

  const encryption = createEncryptionModule({
    kmsClient,
    masterKeyArn: config.kmsMasterKeyAlias,
    dekStore: createPrismaDekStore(prisma),
  });

  const keys = await loadOrGenerateDevKeys(config.devKeyPath);

  const sessions = createSessionModule({
    prisma,
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    jwtIssuer: config.jwtIssuer,
    accessTokenTtlMs: config.accessTokenTtlMs,
    refreshTokenTtlMs: config.refreshTokenTtlMs,
  });

  return {
    config,
    prisma,
    prismaTenant,
    kmsClient,
    s3Client,
    encryption,
    sessions,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  };
}

export async function disposeServices(services: Services): Promise<void> {
  services.kmsClient.destroy();
  services.s3Client.destroy();
  await Promise.all([services.prisma.$disconnect(), services.prismaTenant.$disconnect()]);
}
