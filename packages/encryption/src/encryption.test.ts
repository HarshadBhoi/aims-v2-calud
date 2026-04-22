/**
 * Integration test for the encryption module.
 *
 * Uses Testcontainers to spin up LocalStack (KMS) — we don't need Postgres
 * for this test because we stub the DekStore with an in-memory Map. A
 * separate integration test (in packages/prisma-client or wherever) can
 * exercise the Prisma-backed store.
 *
 * First run pulls localstack/localstack:3.8 (~200MB). Subsequent runs
 * start in ~10–15s.
 */

import { CreateKeyCommand, KMSClient } from "@aws-sdk/client-kms";
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createEncryptionModule, type EncryptionModule } from "./encryption";
import { type DekStore, type StoredDek } from "./types";

let localstack: StartedTestContainer | undefined;
let kmsClient: KMSClient | undefined;
let masterKeyArn: string;
let encryption: EncryptionModule;

/** In-memory stub — keeps the test focused on the encryption module itself. */
function createMemoryStore(): DekStore {
  const store = new Map<string, StoredDek>();
  return {
    get(tenantId) {
      return Promise.resolve(store.get(tenantId) ?? null);
    },
    put(tenantId, wrapped, kmsKeyArn, dekVersion = 1) {
      store.set(tenantId, { wrapped, kmsKeyArn, dekVersion });
      return Promise.resolve();
    },
  };
}

beforeAll(async () => {
  localstack = await new GenericContainer("localstack/localstack:3.8")
    .withEnvironment({
      SERVICES: "kms",
      AWS_DEFAULT_REGION: "us-east-1",
    })
    .withExposedPorts(4566)
    .withWaitStrategy(Wait.forLogMessage(/Ready\./))
    .start();

  const endpoint = `http://${localstack.getHost()}:${localstack.getMappedPort(4566).toString()}`;

  kmsClient = new KMSClient({
    endpoint,
    region: "us-east-1",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  });

  const createKeyResult = await kmsClient.send(
    new CreateKeyCommand({ Description: "test master KEK" }),
  );
  if (!createKeyResult.KeyMetadata?.Arn) {
    throw new Error("LocalStack KMS did not return a key ARN.");
  }
  masterKeyArn = createKeyResult.KeyMetadata.Arn;

  encryption = createEncryptionModule({
    kmsClient,
    masterKeyArn,
    dekStore: createMemoryStore(),
  });
}, 180_000);

afterAll(async () => {
  kmsClient?.destroy();
  await localstack?.stop();
});

describe("encryption module (KMS + DEK cache)", () => {
  const TENANT_1 = "tenant_one";
  const TENANT_2 = "tenant_two";

  it("provisions a DEK for a tenant (idempotent)", async () => {
    await encryption.provisionTenantDek(TENANT_1);
    // Provisioning twice should be a no-op — if it generated a new DEK, the
    // second call would overwrite the first and invalidate any prior
    // ciphertexts.
    await encryption.provisionTenantDek(TENANT_1);
    // The smoke test for idempotence is downstream: the encrypt/decrypt round
    // trip below still works. If provision overwrote the DEK, decryption of
    // the pre-overwrite envelope would throw.
    const envelope = await encryption.encrypt(TENANT_1, "hello");
    await encryption.provisionTenantDek(TENANT_1); // third time
    const roundtrip = await encryption.decrypt(TENANT_1, envelope);
    expect(roundtrip.toString("utf8")).toBe("hello");
  });

  it("round-trips plaintext through encrypt + decrypt", async () => {
    const envelope = await encryption.encrypt(TENANT_1, "sensitive finding content");
    const roundtrip = await encryption.decrypt(TENANT_1, envelope);
    expect(roundtrip.toString("utf8")).toBe("sensitive finding content");
  });

  it("round-trips JSON via encryptJson / decryptJson", async () => {
    const payload = {
      criteria: "GAGAS §6.39 requires four elements",
      condition: "Sample of 40 transactions showed…",
      nested: { foo: 42, bar: true },
    };
    const envelope = await encryption.encryptJson(TENANT_1, payload);
    const roundtrip = await encryption.decryptJson<typeof payload>(TENANT_1, envelope);
    expect(roundtrip).toEqual(payload);
  });

  it("produces distinct ciphertexts for the same plaintext (fresh nonce)", async () => {
    const plaintext = "same plaintext";
    const envA = await encryption.encrypt(TENANT_1, plaintext);
    const envB = await encryption.encrypt(TENANT_1, plaintext);
    expect(envA.equals(envB)).toBe(false);
  });

  it("separates tenant DEKs (tenant2 cannot decrypt tenant1's data)", async () => {
    await encryption.provisionTenantDek(TENANT_2);
    const envelope = await encryption.encrypt(TENANT_1, "tenant1 only");
    await expect(encryption.decrypt(TENANT_2, envelope)).rejects.toThrow();
  });

  it("serves subsequent encrypts from the DEK cache (no extra KMS roundtrip)", async () => {
    // Spy on KMS by wrapping the existing client. Simpler: clear cache, note
    // latency, encrypt twice — second call should be materially faster because
    // it hits the cache, not KMS.
    encryption._clearCache();

    const t0 = performance.now();
    await encryption.encrypt(TENANT_1, "first");
    const coldMs = performance.now() - t0;

    const t1 = performance.now();
    await encryption.encrypt(TENANT_1, "second");
    const warmMs = performance.now() - t1;

    // Warm should be at least 3x faster than cold (cold pays for KMS Decrypt).
    // Not a strict timing test — just a sanity check that caching is effective.
    expect(warmMs * 3).toBeLessThan(coldMs);
  });

  it("throws a descriptive error when a tenant has no DEK provisioned", async () => {
    const freshModule = createEncryptionModule({
      kmsClient: kmsClient!,
      masterKeyArn,
      dekStore: createMemoryStore(),
    });
    await expect(freshModule.encrypt("never_provisioned", "x")).rejects.toThrow(
      /No DEK provisioned/,
    );
  });
});
