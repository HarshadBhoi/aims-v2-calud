/**
 * @aims/encryption
 *
 * Application-Layer Encryption (ALE) per ADR-0001.
 *
 * Plaintext never leaves the application process. Each tenant has its own
 * Data Encryption Key (DEK) wrapped by a KMS Key Encryption Key (KEK).
 * DEK material is fetched lazily, cached in-process, and rotated per policy.
 *
 * SLICE A TASK: This is a placeholder. Real implementation arrives in:
 *   - Task 1.6: encrypt/decrypt via tenant DEK; deterministic variant for
 *              searchable equality; LocalStack KMS mocks in dev.
 *
 * See VERTICAL-SLICE-PLAN.md §4 Week 1 for sequencing.
 */

export const PLACEHOLDER = true as const;
