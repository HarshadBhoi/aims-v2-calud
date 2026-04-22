# 0005 — Session revocation — short-TTL JWT + targeted Redis blocklist

- **Status**: Accepted
- **Date**: 2026-04-20
- **Deciders**: @HarshadBhoi
- **Consulted**: External domain review (Google Gemini, April 2026)
- **Informed**: security, engineering
- **Tags**: #auth #security #compliance

---

## Context

AIMS v2's auth layer uses EdDSA-signed JWTs as access tokens (15-minute TTL) + opaque refresh tokens (rotated per use, family-tracked for theft detection). This was specified in the `auth/` folder before the education docs landed.

The design works well for **normal revocation** — a user logs out, their refresh-token family is invalidated, their next access-token refresh fails, they're out. A user's credentials are rotated; same flow.

It works **less well for incident revocation** — an admin fires a user at 10:00 AM and the security policy requires "session is killed immediately." JWTs are stateless; the access token issued at 09:58 is cryptographically valid until 10:13 regardless of what the auth service wants. Waiting 15 minutes for natural expiry is within most SOC 2 / ISO 27001 interpretations of "timely" but is awkward to explain to a customer asking about their fired finance director who still had access for 12 more minutes.

External domain review in April 2026 correctly flagged that this decision was not specified — we had said "EdDSA JWTs" without saying how we handle instant revocation. Multi-tenant SaaS platforms serving regulated customers need an explicit answer, and the available answers have meaningfully different trade-offs.

---

## Decision

Access tokens are EdDSA JWTs with 15-minute TTL. Refresh tokens are opaque, family-tracked, rotated per use. **Revocation is handled by a targeted Redis blocklist** rather than a global blocklist check on every request.

Specifically: every JWT carries a `blocklist_checkable: boolean` claim. When the claim is `true`, the auth middleware performs a Redis GET (sub-2ms, DEK-cached) against the blocklist on every request; if the token's `jti` (JWT ID) is present in the blocklist, the request is rejected as if the token were expired. When the claim is `false` (the default), the auth middleware verifies the token by signature alone with no Redis hit.

`blocklist_checkable: true` is set on:

- Tokens for admin roles (platform admin, tenant admin, CAE)
- Tokens issued for users whose role includes audit-platform-sensitive privileges (cross-tenant reporting, user management, financial-data access)
- Tokens issued within 15 minutes of a global or tenant-scoped security event (incident in progress, compromised-credential alert)
- Tokens issued for any user with an active "elevated access" flag (on-call engineer during a shift, auditor during final-issuance window)

Blocklist entries TTL at the JWT's natural expiry — once a token would naturally expire, its blocklist entry is no longer needed, and Redis evicts it automatically. This bounds blocklist cardinality to `|active blocklist_checkable tokens|`, which is a small fraction of overall token population.

Revocation operations (admin termination, security-incident kill-switch, forced logout across all devices) enqueue blocklist additions for the affected user's active JWTs. A separate NestJS worker listens on the auth events SQS queue ([ADR-0004](0004-sqs-for-worker-queuing.md)), enumerates the user's active `jti` values, adds them to Redis with appropriate TTL. From revocation request to effective denial: typically <5 seconds.

---

## Alternatives considered

### Option A — Short-TTL JWT + refresh rotation only, no blocklist  (rejected)

Every user's revocation-to-lockout delay is bounded by the JWT TTL (15 minutes). No Redis blocklist. No per-request state lookup.

**Pros**
- Simplest possible implementation
- Zero latency cost on every request (pure signature verification)
- No Redis cardinality management concern

**Cons**
- 15-minute worst case for any revocation scenario, including admin termination
- SOC 2 CC6.3 interpreted as "timely" generally accepts this, but some customer DPAs require "immediate" or specific sub-minute targets
- Awkward to explain to security-conscious customers
- Does not satisfy HIPAA covered-entity termination requirements in stricter interpretations (access to PHI must be revoked "immediately" upon termination, generally read as minutes not quarter-hour)

### Option B — Short-TTL JWT + every-request blocklist check  (rejected)

Every JWT verification includes a Redis GET against the blocklist, regardless of role.

**Pros**
- Uniform revocation latency — instant for all users, no role-based bifurcation
- Simpler mental model (no `blocklist_checkable` flag to reason about)

**Cons**
- Every request pays 1-2ms Redis latency — meaningful at scale for an API serving thousands of requests per second
- Redis becomes an availability-critical dependency — if Redis is down, the API is down (we could fail-open, but that's a security regression)
- Cardinality concern — blocklist entries for every active token, not just sensitive ones

### Option C — Full opaque sessions (no JWT)  (rejected)

Every request hits a session store (Redis) for authentication; no JWT in the mix.

**Pros**
- Instant revocation as a property of the design
- No token-TTL coordination complexity

**Cons**
- Every request hits Redis — higher baseline latency than even Option B
- Session store becomes a hard dependency with strict availability requirements
- Loses JWT benefits — cryptographic self-verification, scale-free verification in the API layer, easy integration with third-party OIDC consumers
- Auth architecture is a substantial rewrite from the already-specified JWT model

### Option D — Short-TTL JWT + targeted blocklist via `blocklist_checkable` claim  (chosen)

The hybrid: normal-user traffic pays no Redis cost; sensitive-role and incident-path tokens get instant revocation via a per-token opt-in claim.

**Pros**
- Normal path stays fast (pure signature verification, no Redis)
- Sensitive paths get instant revocation — admin firings, incident response, elevated-access sessions
- Redis cardinality bounded by `|active blocklist_checkable tokens|`, which is a small fraction of overall token volume
- SOC 2 CC6.3, ISO 27001 A.9, HIPAA §164.308 all satisfied
- Upgrade path — if we later decide every token should be checkable, we flip the default on `blocklist_checkable`

**Cons**
- Claim-based design adds complexity to the token-minting path (must decide at issuance time whether this token should be checkable)
- Retroactive promotion is a corner case — if a user's status changes after their token is issued, and the token is *not* `blocklist_checkable`, we wait for natural expiry for that one token; acceptable trade-off
- Requires clear documentation of which roles / scenarios trigger the flag; risk of drift

---

## Consequences

### Positive
- Normal user traffic pays zero blocklist latency
- Admin terminations, credential compromises, and incident response get instant revocation
- Redis load is bounded to sensitive-role token population
- Design satisfies SOC 2 CC6.3 "timely termination," ISO 27001 A.9.2.6 "removal of access rights," HIPAA §164.308(a)(3)(ii)(C) "termination procedures"
- Redis remains available for its other uses (caching, rate-limiting, session-adjacent state) without becoming critical-path for every API call

### Negative
- Claim-based design adds cognitive complexity — engineers minting tokens must know when to set `blocklist_checkable`
- Matrix of roles-and-scenarios that trigger the flag must be maintained and reviewed — see `auth/REVOCATION-POLICY.md`
- Retroactive promotion of a token from "not checkable" to "checkable" is not possible — we wait for natural expiry
- Incident-response flow must explicitly enumerate a user's active tokens rather than rely on a single "kill all sessions" primitive working uniformly

### Neutral
- Worker-tier capacity planning must account for the revocation worker; expected volume is low (tens of revocations per day at launch scale)
- Token-minting path must read current incident state — implemented via a Redis-cached "active incidents" set with short TTL
- `blocklist_checkable` claim is a structural part of the JWT; minting logic lives in `packages/auth/`

---

## Validation

- **Revocation latency** — from revocation request to effective denial for `blocklist_checkable: true` tokens should be under 5 seconds p99. Monitored via synthetic test triggered daily.
- **Normal-path latency cost** — if enabling this design measurably raises p99 latency on the normal path (tokens without `blocklist_checkable`), something is wrong (the claim should be cheap to check). Target: <0.1ms added latency on the normal path vs. pre-blocklist baseline.
- **Redis blocklist cardinality** — monitor blocklist size weekly; alert if it crosses unexpected thresholds (>10× the running-average number of `blocklist_checkable` active users).
- **Compliance evidence** — annual SOC 2 audit walk-through should demonstrate revocation within the policy's stated timeline; if auditors raise concerns about the 15-minute worst case for non-checkable tokens, we revisit whether more roles should be checkable by default.

---

## Rollout plan

- **Phase 1 — Scaffold** (pre-launch): implement `blocklist_checkable` claim in the token-minting path; implement Redis blocklist with TTL; implement the SQS revocation worker; write integration tests for the full revocation flow; synthetic test running in staging.
- **Phase 2 — Policy publication** (launch readiness): `auth/REVOCATION-POLICY.md` documents which roles / scenarios trigger `blocklist_checkable: true`. Customer-facing DPA references this policy by name.
- **Phase 3 — Compliance evidence** (post-launch): revocation timeline evidence is part of continuous-evidence collection (Drata/Vanta). Annual SOC 2 audit exercises the full revocation flow.

---

## Threats considered

- **Revocation worker failure / delay** — mitigated by SQS durability and DLQ; a failing revocation worker is alerted on within 2 minutes via CloudWatch metric `RevocationWorker.InvocationErrors`. DLQ review is daily.
- **Blocklist cache inconsistency between Redis replicas** — mitigated by using Redis in primary-replica config with short replication lag; blocklist reads hit the primary; the failure mode (replica lag at moment of revocation) is bounded to sub-second windows.
- **Attacker with stolen `blocklist_checkable: false` token evading revocation** — accepted risk for up to 15 minutes; mitigated by upgrading the user's future tokens to checkable once a compromise is suspected; the stolen token naturally expires. For HIPAA-grade scenarios, we can upgrade all tokens to checkable by operator override.
- **Blocklist DoS via generating many revocation requests** — mitigated by rate-limiting revocation requests per admin, per tenant; excess requests queue on SQS but are rate-limited at the worker consumer.
- **Incident-response flow requires knowing every active `jti`** — mitigated by storing active `jti` per user in Redis at mint time, TTL'd at the JWT's natural expiry; incident-response worker enumerates from this set rather than trying to reverse-engineer from the signing path.

---

## References

- [`docs/06-design-decisions.md` §6.7 — Session revocation narrative](../../docs/06-design-decisions.md#67-session-revocation--short-ttl-jwt--targeted-redis-blocklist)
- `auth/README.md` (token structure, refresh-rotation design)
- `auth/REVOCATION-POLICY.md` (the roles / scenarios matrix)
- Gemini domain review, April 2026 (R1 on 06-design-decisions.md)
- SOC 2 TSC CC6.3 (Logical and Physical Access Controls — termination)
- ISO 27001:2022 Annex A.9.2.6 (Removal or adjustment of access rights)
- HIPAA §164.308(a)(3)(ii)(C) (Termination Procedures)
- Related ADRs: [ADR-0004](0004-sqs-for-worker-queuing.md) (revocation worker consumes from SQS); [ADR-0001](0001-ale-replaces-pgcrypto.md) (user PII in the revocation path is ALE-encrypted)

---

<!--
CHANGELOG:
- 2026-04-20: Proposed by @HarshadBhoi following external domain review
- 2026-04-20: Accepted by @HarshadBhoi
-->
