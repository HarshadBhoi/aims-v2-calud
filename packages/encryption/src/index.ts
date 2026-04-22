/**
 * @aims/encryption — Application-Layer Encryption (ALE) per ADR-0001.
 *
 * Public API:
 *   - createEncryptionModule(options)  — main factory
 *   - createPrismaDekStore(prisma)      — default DekStore impl (Prisma-backed)
 *   - encryptRaw / decryptRaw           — pure AES-GCM primitives (low-level)
 *   - DekStore / StoredDek              — types for custom stores
 *
 * Typical wiring in an app:
 *
 *   import { KMSClient } from "@aws-sdk/client-kms";
 *   import { PrismaClient } from "@prisma/client";
 *   import { createEncryptionModule, createPrismaDekStore } from "@aims/encryption";
 *
 *   const prisma = new PrismaClient();
 *   const kmsClient = new KMSClient({
 *     endpoint: process.env["AWS_ENDPOINT_URL"],
 *     region: process.env["AWS_REGION"],
 *   });
 *
 *   const encryption = createEncryptionModule({
 *     kmsClient,
 *     masterKeyArn: process.env["AWS_KMS_MASTER_KEY_ALIAS"]!,
 *     dekStore: createPrismaDekStore(prisma),
 *   });
 *
 *   const envelope = await encryption.encryptJson(tenantId, { foo: "secret" });
 *   // store envelope as Bytes in Prisma
 *
 *   const roundtrip = await encryption.decryptJson<{ foo: string }>(tenantId, envelope);
 */

export {
  createEncryptionModule,
  type EncryptionModule,
  type EncryptionModuleOptions,
} from "./encryption";

export { createPrismaDekStore, type PrismaLike } from "./prisma-dek-store";

export type { DekStore, StoredDek } from "./types";

export {
  DecryptionError,
  EnvelopeError,
  KEY_LENGTH,
  MIN_ENVELOPE_LENGTH,
  NONCE_LENGTH,
  TAG_LENGTH,
  VERSION_BYTE,
  decryptRaw,
  encryptRaw,
} from "./crypto";
