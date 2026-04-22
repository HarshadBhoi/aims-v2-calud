/**
 * Interface the encryption module uses to persist wrapped DEKs.
 *
 * Abstracted so consumers can choose their own backing store:
 *   - PrismaDekStore (default, see prisma-dek-store.ts) — uses the TenantKey table
 *   - Redis-backed cache with fallback to DB — future performance optimization
 *   - In-memory test stub — used in unit tests
 */

export type StoredDek = {
  readonly wrapped: Buffer; // DEK ciphertext (wrapped by a KMS KEK)
  readonly kmsKeyArn: string; // The KEK used to wrap this DEK
  readonly dekVersion: number; // 1 for now; increments on rotation
};

export type DekStore = {
  /** Returns the stored wrapped DEK for this tenant, or null if not provisioned. */
  get(tenantId: string): Promise<StoredDek | null>;

  /** Persists a freshly provisioned DEK. Idempotent (no-op if already stored). */
  put(
    tenantId: string,
    wrapped: Buffer,
    kmsKeyArn: string,
    dekVersion?: number,
  ): Promise<void>;
};
