# Cryptographic Key Rotation

> The per-tenant Data Encryption Key (DEK) and Customer-Managed Key (CMK) rotation runbook. Pairs with [ADR-0001](../references/adr/0001-ale-replaces-pgcrypto.md) (Application-Layer Encryption) and the `packages/encryption/` helper module.

---

## Why this runbook exists

Per ADR-0001, field-level encryption uses envelope encryption: an AWS KMS Customer-Managed Key (CMK) wraps a per-tenant Data Encryption Key (DEK); the API service unwraps the DEK in-process, encrypts/decrypts in memory, and stores only ciphertext in Postgres.

Key rotation is a compliance requirement (SOC 2 CC6.7, ISO 27001 A.10.1.2, HIPAA §164.312(a)(2)(iv)) and a security best practice (limit blast radius if a key is compromised). The AWS KMS CMK rotates automatically; the per-tenant DEK rotation is our responsibility.

This runbook documents both.

---

## Key hierarchy recap

```
AWS KMS Customer-Managed Key (CMK)              ← One per tenant, managed by KMS
          │
          │ wraps (envelope encryption)
          ▼
Data Encryption Key (DEK)                       ← One per tenant, stored as ciphertext
          │
          │ decrypted in application memory only
          ▼
Plaintext DEK in application process            ← Never written to disk, never logged
          │
          │ used to encrypt/decrypt field content
          ▼
Field ciphertext in Postgres                    ← What we actually store
```

---

## What rotates, how often, and why

| Key | Rotation cadence | Mechanism | Data re-encryption |
|---|---|---|---|
| **KMS CMK** | 365 days (AWS managed) | Automatic — KMS creates new key version; old versions retained for decrypt-only | No. DEK is rewrapped under the new CMK version; ciphertext unchanged. |
| **Per-tenant DEK** | 90 days | Scheduled NestJS worker | Yes. All fields encrypted with the old DEK are re-encrypted with the new DEK. |
| **Blind-index HMAC secret** | 365 days | Manual, coordinated with a rebuild of blind-index columns | Yes. Blind indexes are regenerated from plaintext (decrypted via the active DEK at the time of rebuild). |
| **Emergency rotation** (suspected compromise) | Immediate | On-demand via `security/runbooks/key-rotation-emergency.md` | Yes. Same mechanism as scheduled rotation but run immediately. |

---

## KMS CMK rotation — automatic

AWS KMS rotates the CMK's backing key material every 365 days by default. This is a metadata operation:

- New CMK version generated
- Previous versions retained (decrypt-only) indefinitely
- Existing ciphertext encrypted under the old version continues to decrypt transparently
- New encryptions use the newest version

Nothing for us to do operationally. We enable the `EnableKeyRotation` flag on every per-tenant CMK in Terraform:

```hcl
resource "aws_kms_key" "tenant_cmk" {
  for_each                 = toset(local.active_tenants)
  description              = "Per-tenant CMK for ${each.key}"
  deletion_window_in_days  = 30
  enable_key_rotation      = true  # ← This
  key_usage                = "ENCRYPT_DECRYPT"
  customer_master_key_spec = "SYMMETRIC_DEFAULT"

  tags = {
    TenantId = each.key
    Purpose  = "ALE-envelope-encryption"
  }
}
```

CloudWatch alarm on `KMSKeyRotationEnabled` being false for any tenant CMK — any disabled rotation is an immediate P2 investigation.

---

## Per-tenant DEK rotation — scheduled, 90 days

### Trigger

EventBridge Scheduler rule fires the `dek-rotation-check` worker once per tenant per week. The worker checks if the tenant's DEK was issued more than 90 days ago; if so, it triggers rotation for that tenant.

Staggering: we spread rotations across the week via the EventBridge rule's tenant-slicing logic, so we don't rotate every tenant on the same day.

### Procedure (what the worker does)

1. **Generate new DEK**: Call `kms:GenerateDataKey` against the tenant's CMK. Store the new wrapped DEK in the `tenant_encryption_keys` table with `status = pending` and `version = N+1` where N is the current version.
2. **Queue re-encryption job per encrypted table**: For every table containing fields encrypted with this tenant's DEK, enqueue a re-encryption job to SQS. The jobs run in parallel; each re-encrypts its table's rows in batches of 1000.
3. **Re-encrypt rows**:
   - Read rows in tenant-scoped batches
   - For each row, decrypt fields with the old DEK (DEK version N), re-encrypt with the new DEK (version N+1)
   - UPDATE the row atomically with new ciphertexts + `encryption_key_version = N+1`
   - Commit in batch-sized transactions to avoid long locks
4. **Verify coverage**: Job queries `SELECT COUNT(*) FROM <table> WHERE encryption_key_version < N+1 AND tenantId = $1` — should return 0 when done. If nonzero, retry or escalate.
5. **Mark new DEK active**: Update `tenant_encryption_keys` — set `status = active` on version N+1, `status = retired` on version N. Version N's wrapped DEK is *retained* for audit purposes (ability to decrypt historical ciphertext if ever needed), but encryption middleware will only use version N+1 for new writes.
6. **Emit audit event**: `tenant.dek.rotated` event written to the hash-chained audit log with tenant ID, new version, old version, worker instance, timestamp.

### During rotation

- The encryption middleware reads the active DEK at the start of each request. If the active DEK changes mid-request (rotation completes), the in-process cache picks up the new version on the next request.
- Read requests continue to work: decryption attempts the active version first, falls back to retired versions if ciphertext version tag mismatches.
- Write requests use the active version (post-rotation, version N+1).
- Rotation is tenant-scoped; other tenants are unaffected.

### Failure modes and handling

| Failure | Detection | Handling |
|---|---|---|
| KMS unavailable mid-rotation | KMS API error in worker | Abort rotation; keep old DEK active; CloudWatch alarm fires; retry in the next scheduled window |
| Worker crashes mid-batch | Batch not committed; job retries | SQS redelivery with idempotency key; already-re-encrypted rows (detected via `encryption_key_version`) are skipped |
| Post-rotation verification fails (leftover old-version rows) | Step 4 check | Alarm fires; rotation is marked `status = partial`; on-call investigates — usually a row in a shard worker didn't process; manually re-run that batch |
| Concurrent tenant activity during rotation | Long-running transactions blocking UPDATE | Batch-size tuning (1000 rows/batch balances throughput and lock duration); peak-hour rotation avoided via EventBridge scheduling |

### Observability

CloudWatch metrics per tenant:

- `Crypto.DekRotationDurationSeconds` — target p99 <30 min
- `Crypto.DekRotationRowsProcessed` — counter, total rows re-encrypted
- `Crypto.DekRotationFailureCount` — alert on any value >0
- `Crypto.DekActiveAgeDays` — target max 90; if >100 for any tenant, rotation is overdue

---

## Blind-index HMAC secret rotation — 365 days, coordinated

Blind indexes are HMAC-SHA256 of plaintext under a per-tenant secret, stored alongside the ciphertext for search-without-reversibility patterns (primarily on PII: email search, SSN matching).

Rotating the HMAC secret means regenerating every blind-index column from plaintext. More complex than DEK rotation because:

- We must decrypt the plaintext (requires active DEK)
- We compute the new blind index under the new secret
- We overwrite the blind-index column

The sequence:

1. Schedule rotation during a maintenance window (blind-index-based lookups return stale results during the transition; we prefer doing this at 2am tenant-local time)
2. Generate new HMAC secret; store alongside the existing one with `status = pending`
3. For every table with blind indexes, enqueue a regeneration job to SQS
4. Regenerate: decrypt row's plaintext, compute new blind index under new secret, UPDATE
5. Once all tables done, mark new secret `status = active`, old secret `status = retired` (retained for audit)
6. Application reads blind indexes using the active secret only

Annually per tenant. Manual trigger by @security ticket; not fully automated (yet) given the lookup-staleness consideration.

---

## Emergency rotation — suspected compromise

If a DEK or CMK is suspected compromised:

1. **Open a SEC-P1 incident** per `security/INCIDENT-RESPONSE.md`
2. **Disable the suspect key** immediately in KMS (via `aws kms disable-key` or Terraform + targeted apply) — new encryption operations fail fast; existing decryption continues via retained versions
3. **Rotate immediately** — run the DEK rotation worker with `priority = emergency` override, which bypasses the 90-day schedule check
4. **Audit-log search** — determine what was encrypted under the compromised key, what access patterns occurred since issuance
5. **Post-mortem and policy update** — document root cause, update runbooks and monitoring as needed

This path is documented in detail at `security/runbooks/key-rotation-emergency.md` (to be authored).

---

## Compliance mapping

| Framework | Control | How rotation satisfies |
|---|---|---|
| **SOC 2 TSC CC6.7** | Key management and rotation | Automated 90-day DEK rotation with audit-log evidence |
| **ISO 27001 A.10.1.2** | Cryptographic key management | Documented lifecycle (issue / use / rotate / retire); rotation cadence defined; roles accountable |
| **HIPAA §164.312(a)(2)(iv)** | Encryption and decryption key controls | Application-layer encryption + per-tenant keys + rotation + access auditing |
| **FedRAMP SC-12** | Cryptographic key establishment and management | NIST SP 800-57 aligned; AWS KMS FIPS 140-2 validated; rotation enforced |
| **PCI DSS 3.6** | Key management for cardholder data encryption | (Applies if we ever hold PAN; currently we don't) |

---

## Responsibilities

| Role | Accountability |
|---|---|
| @security | Policy ownership; emergency rotation runbook; audit evidence collection |
| @devops-owners | EventBridge Scheduler rules; KMS CMK Terraform; CloudWatch alarms |
| @database-owners | Re-encryption worker implementation; batch-size tuning; database impact monitoring |
| @auth-owners | Integration with `packages/encryption/`; ensuring middleware picks up new DEK versions |

CODEOWNERS routes this file + `packages/encryption/` + the `tenant_encryption_keys` table migrations to @security.

---

## References

- [ADR-0001 — ALE replaces pgcrypto](../references/adr/0001-ale-replaces-pgcrypto.md)
- [database/README.md §7 — Field-Level Encryption](../database/README.md)
- [docs/06-design-decisions.md §2.3 — Application-Layer Encryption](../docs/06-design-decisions.md)
- AWS KMS — [Rotating AWS KMS keys](https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html)
- NIST SP 800-57 — Key Management Recommendations
- OWASP Cryptographic Storage Cheat Sheet

---

*Last reviewed: 2026-04-20.*
