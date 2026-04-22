/**
 * @aims/encryption — high-level ALE module (ADR-0001).
 *
 * Composition:
 *   - crypto.ts    — pure AES-GCM primitives
 *   - kmsClient    — AWS KMS (or LocalStack in dev) for DEK wrap/unwrap
 *   - dekStore     — persistent wrapped-DEK storage (Prisma by default)
 *   - cache        — in-process plaintext DEK cache (LRU + TTL)
 *
 * Lifecycle:
 *   - Tenant provisioning: `provisionTenantDek(tenantId)` generates a fresh DEK
 *     via KMS GenerateDataKey, stores the wrapped copy, caches the plaintext.
 *   - Encryption at runtime: `encrypt(tenantId, plaintext)`:
 *       1. Get plaintext DEK from cache (hit) or unwrap via KMS Decrypt (miss).
 *       2. Encrypt plaintext with DEK using crypto.ts primitives.
 *       3. Return envelope bytes for storage.
 *   - Decryption at runtime: reverse of encryption.
 *
 * Plaintext DEKs live in the cache for `cacheTtlMs` (default 15 min) then
 * are evicted. This limits the window during which a compromised process
 * memory could leak keys.
 */

import {
  DecryptCommand,
  type KMSClient,
  GenerateDataKeyCommand,
} from "@aws-sdk/client-kms";
import { LRUCache } from "lru-cache";

import { decryptRaw, encryptRaw } from "./crypto";
import { type DekStore } from "./types";

export type EncryptionModuleOptions = {
  readonly kmsClient: KMSClient;
  /** The master KEK alias or ARN (e.g. "alias/aims-dev-master"). */
  readonly masterKeyArn: string;
  readonly dekStore: DekStore;
  /** Max number of tenant DEKs cached in memory (default 1000). */
  readonly cacheSize?: number;
  /** DEK cache TTL in milliseconds (default 15 minutes). */
  readonly cacheTtlMs?: number;
};

export type EncryptionModule = {
  encrypt(tenantId: string, plaintext: Buffer | string): Promise<Buffer>;
  decrypt(tenantId: string, envelope: Buffer): Promise<Buffer>;
  encryptJson(tenantId: string, value: unknown): Promise<Buffer>;
  decryptJson<T = unknown>(tenantId: string, envelope: Buffer): Promise<T>;
  provisionTenantDek(tenantId: string): Promise<void>;
  /** Test helper — clears the in-process DEK cache. */
  _clearCache(): void;
};

export function createEncryptionModule(options: EncryptionModuleOptions): EncryptionModule {
  const { kmsClient, masterKeyArn, dekStore } = options;

  const cache = new LRUCache<string, Buffer>({
    max: options.cacheSize ?? 1000,
    ttl: options.cacheTtlMs ?? 15 * 60 * 1000,
  });

  async function getPlaintextDek(tenantId: string): Promise<Buffer> {
    const cached = cache.get(tenantId);
    if (cached) return cached;

    const stored = await dekStore.get(tenantId);
    if (!stored) {
      throw new Error(
        `No DEK provisioned for tenant ${tenantId}. ` +
          `Call provisionTenantDek() as part of tenant creation.`,
      );
    }

    // Unwrap the DEK via KMS.
    const cmd = new DecryptCommand({
      CiphertextBlob: stored.wrapped,
      KeyId: stored.kmsKeyArn,
    });
    const result = await kmsClient.send(cmd);
    if (!result.Plaintext) {
      throw new Error(`KMS Decrypt returned no plaintext for tenant ${tenantId}`);
    }

    const dek = Buffer.from(result.Plaintext);
    cache.set(tenantId, dek);
    return dek;
  }

  async function provisionTenantDek(tenantId: string): Promise<void> {
    const existing = await dekStore.get(tenantId);
    if (existing) return; // idempotent

    const cmd = new GenerateDataKeyCommand({
      KeyId: masterKeyArn,
      KeySpec: "AES_256",
    });
    const result = await kmsClient.send(cmd);
    if (!result.Plaintext || !result.CiphertextBlob) {
      throw new Error(
        `KMS GenerateDataKey response missing plaintext/ciphertext for tenant ${tenantId}`,
      );
    }

    await dekStore.put(tenantId, Buffer.from(result.CiphertextBlob), masterKeyArn, 1);
    cache.set(tenantId, Buffer.from(result.Plaintext));
  }

  async function encrypt(tenantId: string, plaintext: Buffer | string): Promise<Buffer> {
    const dek = await getPlaintextDek(tenantId);
    const pt = typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext;
    return encryptRaw(dek, pt);
  }

  async function decrypt(tenantId: string, envelope: Buffer): Promise<Buffer> {
    const dek = await getPlaintextDek(tenantId);
    return decryptRaw(dek, envelope);
  }

  async function encryptJson(tenantId: string, value: unknown): Promise<Buffer> {
    return encrypt(tenantId, JSON.stringify(value));
  }

  async function decryptJson<T>(tenantId: string, envelope: Buffer): Promise<T> {
    const pt = await decrypt(tenantId, envelope);
    return JSON.parse(pt.toString("utf8")) as T;
  }

  return {
    encrypt,
    decrypt,
    encryptJson,
    decryptJson,
    provisionTenantDek,
    _clearCache: () => {
      cache.clear();
    },
  };
}
