# 0001 — Application-Layer Encryption replaces `pgcrypto` for field-level encryption

- **Status**: Accepted
- **Date**: 2026-04-20
- **Deciders**: @HarshadBhoi
- **Consulted**: External domain review (Google Gemini, April 2026)
- **Informed**: engineering, security
- **Tags**: #security #database #encryption #multi-tenancy

---

## Context

AIMS v2 is a multi-tenant SaaS holding sensitive audit content: independence declarations, engagement-confidential notes, finding narratives that may quote auditee PII, work-paper excerpts that may contain SSNs or account numbers, and tenant-confidential commentary. A portion of these fields require field-level encryption beyond the platform-level encryption AWS KMS provides for EBS, RDS, and S3.

The initial `database/` plan specified Postgres `pgcrypto` for field-level encryption — symmetric encryption performed inside Postgres using keys supplied at query time (or stored in a separate `encryption_keys` table).

External domain review in April 2026 flagged this as a known security anti-pattern for any data that is queryable or PII. `pgcrypto` requires the symmetric key to be present in Postgres memory space during encryption and decryption. This creates several well-documented leakage vectors:

- **Query logs** — `pgcrypto` function calls with keys as arguments appear in slow-query logs, `pg_stat_statements`, and `auto_explain` output
- **Memory dumps** — Postgres memory dumps (whether from a crash, a debugging session, or a compromised superuser) contain keys in cleartext
- **Replication streams** — replication of the query or the functions carries keys across network boundaries
- **Extension ecosystem** — any extension running in the same Postgres instance shares the same memory space as the key material

A decision on encryption architecture is needed *before* the first encrypted-field code path is written, because retrofitting from in-DB encryption to application-layer encryption requires re-encrypting all data and invalidating any indexes built on the ciphertext.

---

## Decision

Field-level encryption happens at the application layer, **not** inside Postgres.

AWS KMS wraps a per-tenant Data Encryption Key (DEK) using envelope encryption. The API service (on both the Fastify request path and the NestJS worker tier) unwraps the tenant's DEK in-process when a request enters, caches it for the lifetime of the request (or a short TTL for long-running workers), encrypts plaintext on write and decrypts ciphertext on read, and never sends the DEK or plaintext to Postgres.

- For fields requiring equality search (e.g., looking up a user by email), we use **deterministic encryption** with per-tenant keys — ciphertext is stable for the same plaintext within a tenant, allowing `WHERE encrypted_email = $1` without plaintext exposure.
- For fields requiring search-without-reversibility (partial-match, prefix, or type-ahead), we store a **blind index** alongside the ciphertext: HMAC-with-per-tenant-secret over the plaintext, stored as a separate column, queryable but not reversible without the per-tenant secret.
- `pgcrypto` is not used for any queryable or PII field. It remains available for use cases where the data never leaves a single encryption boundary (not a currently-planned pattern).

Implementation lives in `api/lib/encryption/` as a shared helper module used by both the Fastify request path and the NestJS worker tier.

---

## Alternatives considered

### Option A — `pgcrypto` in Postgres  (rejected)

The original plan. Symmetric encryption via `pgcrypto`'s `pgp_sym_encrypt` and `pgp_sym_decrypt` functions, with keys stored in a separate `encryption_keys` table or passed at query time.

**Pros**
- Simple SQL-level API; minimal application code
- Decryption happens inline with the query — no round-trip cost
- Well-known to Postgres DBAs

**Cons**
- Keys in Postgres memory space — leakage via query logs, `pg_stat_statements`, memory dumps, replication streams
- Key rotation is operationally painful (must re-encrypt all rows)
- Any Postgres extension shares the memory space
- A compromised DB superuser reads all tenants' data
- Does not meet the threat model where we must assume the DB layer can be compromised without compromising customer data

### Option B — Application-Layer Encryption with KMS-wrapped per-tenant DEKs  (chosen)

AWS KMS wraps a per-tenant DEK. The API service handles all encryption/decryption in-process. Postgres only ever sees ciphertext for encrypted fields.

**Pros**
- Keys never enter Postgres memory
- Per-tenant cryptographic boundary — compromise of one tenant's DEK does not affect others
- AWS KMS provides audit trail of every DEK unwrap (satisfies SOC 2 CC6.7, ISO 27001 A.10 evidence requirements)
- Industry-standard pattern (envelope encryption)
- Compatible with deterministic encryption for equality search and blind indexes for non-reversible search
- Key rotation is a metadata operation (rewrap DEK under new KMS key), not a data operation, for the common case

**Cons**
- Application-layer complexity — every encrypted-field code path must use the helper module correctly
- Deterministic encryption is a weaker guarantee than randomized encryption (pattern leakage within a tenant for equality-encrypted fields) — must be documented as such; only used where the trade-off is acceptable
- KMS availability becomes a dependency on the critical path — mitigated by in-process DEK caching with short TTL
- Adds measurable CPU cost per encrypted field (~10-50ns per AES-GCM op on modern hardware; not load-bearing at expected scale but noted)

### Option C — Transparent Data Encryption (TDE) at the storage layer only  (rejected)

Rely on AWS KMS + RDS/EBS TDE for at-rest encryption; no application-layer field encryption.

**Pros**
- No application code required
- Already free on AWS RDS
- Covers most regulatory at-rest requirements for non-PII data

**Cons**
- Does not protect against threats above the storage layer — a compromised app service still reads plaintext
- Does not provide per-tenant cryptographic boundaries
- Does not satisfy the threat model for PII, independence declarations, or tenant-confidential content where we must assume the DB layer can be compromised
- Does not support the "rogue DBA" threat — TDE keys are held by the cloud provider, not per-tenant

### Option D — Client-side encryption (encryption in the browser before data reaches our API)  (rejected)

Customer-managed keys, encryption in the user's browser, our service stores only ciphertext with no ability to decrypt.

**Pros**
- Strongest possible threat model — even our service cannot read customer data
- Satisfies the most paranoid compliance requirements

**Cons**
- Makes server-side search, reporting, PDF generation, cross-engagement aggregation impossible
- Key recovery is the customer's problem — lost key means lost data
- Not compatible with the product's core value proposition (server-side findings management, multi-user collaboration, PDF generation)

---

## Consequences

### Positive
- Keys never live in Postgres memory; key-leakage vectors tied to `pg_stat_statements`, query logs, memory dumps, replication are eliminated
- Per-tenant cryptographic boundary — DEK compromise is bounded to one tenant
- KMS audit trail satisfies SOC 2 CC6.7 and ISO 27001 A.10 evidence requirements
- Blind-index pattern preserves search usability on encrypted PII (auditor can type-ahead on an auditee's name without the server having access to the name plaintext outside the request lifecycle)
- Pattern is familiar to production-savvy engineers and passes external security review cleanly

### Negative
- Every encrypted-field code path runs decryption in-process — measurable CPU cost; must be monitored at scale
- Deterministic encryption is a weaker guarantee than randomized and must be documented and restricted to fields where equality search is required
- KMS is on the critical path for encrypted field reads — requires in-process DEK caching and a fallback plan during KMS regional issues
- Key rotation mechanics must be implemented and tested (rewrapping DEKs under a new KMS key; rewrapping existing ciphertexts under a rotated DEK if the DEK itself rotates, which is rare)

### Neutral
- Requires `api/lib/encryption/` helper module with encrypt/decrypt, deterministic encrypt, and blind-index functions, plus unit and integration tests
- Requires per-tenant DEK rotation runbook in `security/ROTATION.md`
- Requires that the `database/` folder documentation be reconciled to remove `pgcrypto` references — tracked as part of the post-Gemini-review reconciliation workstream

---

## Validation

- If KMS `Decrypt` latency on the critical path exceeds 5ms p99 at baseline load even with in-process DEK caching, revisit the caching strategy (longer TTL, pre-warming, or regional KMS replication)
- If we find ourselves wanting to decrypt at the DB layer for reporting performance, we revisit — the answer is likely "decrypt in a background worker that writes denormalized data into a search index," not "re-add `pgcrypto`"
- If encrypted-field CPU cost exceeds 5% of total API CPU at expected scale, revisit whether some low-sensitivity fields can be moved off ALE
- If a security incident discloses key material — at any layer — we revisit both the threat model and the ALE implementation

---

## Rollout plan

- **Phase 1 — Build** (pre-launch): implement `api/lib/encryption/` with KMS envelope helpers, deterministic-encrypt helper, blind-index helper, and in-process DEK cache. Unit tests for roundtrip correctness, deterministic encryption stability, blind-index collision resistance, cross-tenant isolation. Integration tests against real KMS (via LocalStack in CI; real KMS in staging).
- **Phase 2 — Adopt** (immediate for all new work): every new encrypted-field code path uses the helper module. No `pgcrypto` usage in any new schema or query. CI lint rule rejects any SQL that invokes `pgp_sym_encrypt`, `pgp_sym_decrypt`, or `pgcrypto` functions.
- **Phase 3 — Reconcile** (part of folder reconciliation workstream): `database/` folder content updated to remove `pgcrypto` references; `security/ROTATION.md` added with DEK rotation runbook; `security/EVIDENCE-COLLECTION.md` updated to include KMS audit trail as SOC 2 / ISO 27001 evidence source.

Since no encrypted data exists yet (pre-launch), there is no migration or re-encryption of existing rows.

---

## Threats considered

- **Compromised API pod reads plaintext during decryption** — mitigated by short pod lifetimes (K8s rolling deployment, pod age <24h at steady state), pod identity via IRSA, KMS policy restricting `Decrypt` to specific pod roles. Post-compromise damage is limited to one tenant's data during the pod's remaining lifetime, not the entire dataset.
- **Key leakage via application logs** — mitigated by a log-redaction middleware that strips fields labeled `encrypted-at-rest` before emitting; encrypted-field identifiers are tagged at the Zod schema level so the redaction middleware knows what to strip.
- **KMS unavailability** — mitigated by short-lived in-process DEK cache (5-min TTL) that allows the app to keep serving reads during a brief KMS regional issue; writes fail fast and return 503 if KMS is unreachable and no cached DEK is available.
- **Deterministic-encryption pattern leakage** — mitigated by restricting deterministic encryption to fields where equality search is genuinely required (email, SSN for matching). Pattern analysis within a single tenant's data is an accepted risk; cross-tenant pattern analysis is prevented by per-tenant keys.
- **Blind-index HMAC secret compromise** — mitigated by per-tenant HMAC secrets wrapped under KMS same as DEKs; compromise of one tenant's HMAC secret allows offline brute-forcing of that tenant's blind indexes but no others.

---

## References

- [`docs/04-architecture-tour.md` §5.1 — Infrastructure (encryption pattern)](../../docs/04-architecture-tour.md#51-infrastructure)
- [`docs/04-architecture-tour.md` §12 — Domain review notes (blocking item 1)](../../docs/04-architecture-tour.md#12-domain-review-notes)
- Gemini domain review, April 2026 (R1 on 04-architecture-tour.md)
- AWS KMS envelope encryption pattern — [AWS Key Management Service Developer Guide](https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#enveloping)
- OWASP Cryptographic Storage Cheat Sheet — application-layer encryption guidance
- Related ADRs: [ADR-0002](0002-tenant-isolation-two-layer.md) (tenant isolation — ALE per-tenant keys are part of the defence-in-depth)

---

<!--
CHANGELOG:
- 2026-04-20: Proposed by @HarshadBhoi following external domain review
- 2026-04-20: Accepted by @HarshadBhoi
-->
