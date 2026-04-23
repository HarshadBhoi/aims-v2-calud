/**
 * Service container — created once at server startup, injected into the
 * tRPC context for every request.
 *
 * Services are long-lived singletons: the Prisma client, the encryption
 * module, the session module, the key pair. Per-request state (user,
 * session, tenant) lives in the tRPC context, not here.
 */

import { createEncryptionModule, createPrismaDekStore, type EncryptionModule } from "@aims/encryption";
import { createAdminPrismaClient, type AdminPrismaClient } from "@aims/prisma-client";
import { KMSClient } from "@aws-sdk/client-kms";
import { type KeyLike } from "jose";

import { loadOrGenerateDevKeys } from "./auth/dev-keys";
import { createSessionModule, type SessionModule } from "./auth/session-lifecycle";
import { type Config } from "./config";

export type Services = {
  readonly config: Config;
  readonly prisma: AdminPrismaClient;
  readonly kmsClient: KMSClient;
  readonly encryption: EncryptionModule;
  readonly sessions: SessionModule;
  readonly publicKey: KeyLike;
  readonly privateKey: KeyLike;
};

export async function createServices(config: Config): Promise<Services> {
  const prisma = createAdminPrismaClient();

  const kmsClient = new KMSClient({
    region: config.awsRegion,
    ...(config.awsEndpointUrl ? { endpoint: config.awsEndpointUrl } : {}),
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
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
    kmsClient,
    encryption,
    sessions,
    publicKey: keys.publicKey,
    privateKey: keys.privateKey,
  };
}

export async function disposeServices(services: Services): Promise<void> {
  services.kmsClient.destroy();
  await services.prisma.$disconnect();
}
