# Session Revocation Policy

> The matrix of roles, scenarios, and conditions that determine which tokens carry the `blocklist_checkable: true` claim at mint time. Pairs with [ADR-0005](../references/adr/0005-session-revocation-hybrid.md) and [SESSION-MANAGEMENT.md §6](SESSION-MANAGEMENT.md#6-jwt-revocation--short-ttl--targeted-redis-blocklist).

---

## Why this policy exists

Per ADR-0005, access tokens are EdDSA JWTs with 15-minute TTL. Normal user tokens rely on the TTL for natural revocation — simple, fast, no per-request state lookup. Certain tokens, however, must support **instant revocation**: an admin being terminated, a credential compromise response, an elevated-access session being cut short.

The mechanism is a per-token opt-in: the JWT carries a `blocklist_checkable: boolean` claim. When `true`, the auth middleware checks a Redis blocklist on every request bearing that token. When `false` (the default), no Redis hit.

The question this document answers: *who gets a `blocklist_checkable: true` token, and under what conditions?*

---

## The principle

`blocklist_checkable: true` is used where the cost of delayed revocation outweighs the per-request Redis latency. That's a small minority of tokens in practice — maybe 2-5% of issued tokens at steady state, depending on tenant mix.

Three buckets drive the flag to `true`:

1. **Role-based** — the user holds a role where instant revocation is a compliance requirement
2. **Privilege-based** — the token was minted for a session with elevated privileges (support access, cross-tenant reporting, financial-data access)
3. **Event-based** — the token was minted during an active security event where instant revocation capability matters

A token gets `blocklist_checkable: true` if *any* bucket applies. The default is `false`.

---

## Role-based — always `blocklist_checkable: true`

| Role | Reason | Compliance driver |
|---|---|---|
| Platform admin | Cross-tenant access; platform-wide impact radius | SOC 2 CC6.3 elevated-access termination |
| Tenant admin | Tenant-wide configuration access; can provision users, change SSO settings | ISO 27001 A.9.2.6 privileged-access controls |
| CAE (Chief Audit Executive) | Can approve engagement issuance; access to all tenant findings | GAGAS §3.56 independence concerns require prompt off-boarding |
| Security officer | Can view full audit log, manage keys, view user activity | HIPAA §164.308(a)(3)(ii)(C) PHI access termination |
| Billing admin | Can change subscription, view invoices, modify payment methods | PCI DSS consideration (future); financial-fraud prevention |
| Support staff (with cross-tenant access) | Can impersonate tenant users for troubleshooting | SOC 2 CC6.3 + audit-trail-integrity concerns |

These roles get `blocklist_checkable: true` on every token issued, regardless of circumstance. If the user later changes role, their existing tokens keep the claim until natural expiry (15 min); the next token issued reflects the new role.

---

## Privilege-based — `blocklist_checkable: true` during the elevation

| Elevated state | Reason | Typical duration |
|---|---|---|
| On-call engineer during a shift | Can access production via break-glass flow | 1 shift (8h) |
| Auditor during engagement-issuance window | Can lock findings, trigger report generation | 1-2 weeks before issuance |
| User performing cross-tenant query (support/admin tooling) | Cross-tenant data visibility | duration of specific session |
| User with active "step-up MFA" for sensitive action | Short-window elevated trust | 10 minutes post-MFA |
| User whose account was recently compromised (see below) | Forensic concerns require instant re-revocation if needed | 72 hours post-compromise-resolution |

The elevation is time-bounded. Tokens issued during the elevated window carry the flag; tokens issued before or after do not.

Implementation: an `elevated_access` Redis set tracks which users are currently elevated. The token-mint path checks this set before issuing; if the user is present, the flag is set.

---

## Event-based — `blocklist_checkable: true` during the event

| Event | Scope | Duration |
|---|---|---|
| Global security incident (P1 security bridge active) | All users, all tenants | Duration of the incident |
| Tenant-scoped security incident | All users in the affected tenant | Duration of the incident |
| Tenant-scoped "aggressive rotation" mode (e.g., shared-credential leak detected) | All users in the affected tenant | Until rotation window closes |
| Suspected account takeover (the user in question) | Specific user | 24 hours minimum |
| MFA enrollment event within last 15 minutes | The user who just enrolled | 15 minutes (prevents a compromised pre-MFA session from outlasting MFA) |

During an active event, the mint path reads an `active_security_events` Redis set; any user matching the event criteria gets the flag set on their newly-minted tokens. When the event ends, the set is cleared and subsequent tokens revert to their default flag based on role and elevation alone.

---

## Compliance-framework mapping

| Framework | Control | How this policy satisfies |
|---|---|---|
| **SOC 2 TSC CC6.3** | "Logical access is revoked in a timely manner upon termination or role change" | Role-based bucket ensures admin / privileged terminations are instant; normal-user terminations complete within 15 min naturally |
| **ISO 27001 A.9.2.6** | "Access rights shall be removed upon termination of employment or adjusted upon change" | Same as SOC 2 CC6.3; privileged-access instant, normal timely |
| **HIPAA §164.308(a)(3)(ii)(C)** | "Termination procedures for PHI access" | Security officer and any role with PHI access get instant revocation via blocklist |
| **PCI DSS 8.1.4** | "Remove/disable inactive user accounts within 90 days" | Orthogonal (addressed via session cleanup job, not this policy) |
| **FedRAMP AC-2(1)** | "Automated removal of access" | Same mechanism as SOC 2 CC6.3; works for GovCloud silo once that ships |

---

## The non-flag path — what about everyone else?

Most users — regular staff auditors, viewers, readers — get `blocklist_checkable: false` tokens. Their session data:

- JWT verified by signature on every request (fast; no Redis hit)
- TTL 15 minutes; after admin-initiated revocation or user-initiated logout, the access token continues to validate until natural expiry
- Refresh-token family is invalidated immediately; no *new* access tokens will be issued for the session
- Effective revocation window: zero to 15 minutes depending on when in the TTL the revocation fires

This is acceptable for SOC 2 CC6.3 and ISO 27001 A.9.2.6 in standard interpretations. It's explicitly documented in the trust center so customers are not surprised.

If a customer contractually requires instant revocation for all users (rather than just privileged roles), we can flip the flag globally for that tenant via a tenant-configuration setting `require_instant_revocation: true`. The cost is Redis latency on every request for that tenant's users; the benefit is contractual compliance. This is a tenant-admin-visible setting.

---

## Implementation notes

**Where the decision happens**: `packages/auth/src/token-mint.ts`. The `shouldCheckBlocklist()` function reads the user's role, the elevated-access set, and the active-security-events set, and returns the boolean.

**Where the check happens**: `packages/auth/src/middleware/verify-token.ts`. After JWT signature verification, if the claim is true, the middleware does the Redis GET.

**Where the blocklist is populated**: `api/workers/revocation-worker/`. Reads `session.revoke_requested` events from the outbox (per ADR-0004); enumerates the user's active `jti` values from the `user_active_tokens:{userId}` Redis set; adds each to the blocklist with TTL = remaining JWT lifetime.

**Where active `jti` tracking happens**: token-mint path writes to `user_active_tokens:{userId}` (a Redis set with TTL ≤ JWT lifetime). Enables the revocation worker to enumerate tokens to invalidate without scanning the entire blocklist space.

---

## Monitoring

CloudWatch metrics:

- `Auth.BlocklistCheckCount` — per minute; should correlate with admin/privileged traffic volume
- `Auth.BlocklistHitCount` — per minute; a nonzero value means real revocations are propagating (expected occasionally)
- `Auth.BlocklistLatencyP99` — target <2ms; above 5ms is a Redis health issue
- `Auth.BlocklistCardinality` — total entries in the blocklist; should stay bounded (minutes-scale TTLs expire entries)
- `Auth.RevocationToRedisLatency` — from SQS revocation event to Redis blocklist add; target <5s p99
- `Auth.TokenMintFlagTrueRate` — percentage of minted tokens with `blocklist_checkable: true`; target 2-5% at steady state; sustained >15% suggests the policy is catching too many users

---

## Policy updates

This document changes when:

- New roles are added that warrant instant revocation → add to Role-based table
- New elevated-access scenarios emerge → add to Privilege-based table
- A compliance requirement changes what counts as "timely" revocation → reassess the policy's default case
- A customer contract requires tenant-specific revocation behaviour → add tenant-config setting

Changes to the policy itself require @security and @auth-owners review via CODEOWNERS.

---

## References

- [ADR-0005 — Session revocation hybrid](../references/adr/0005-session-revocation-hybrid.md)
- [auth/SESSION-MANAGEMENT.md §6 — JWT Revocation](SESSION-MANAGEMENT.md#6-jwt-revocation--short-ttl--targeted-redis-blocklist)
- [docs/06-design-decisions.md §6.7 — Session revocation](../docs/06-design-decisions.md#67-session-revocation--short-ttl-jwt--targeted-redis-blocklist)
- SOC 2 Trust Services Criteria — CC6.3 (Logical access termination)
- ISO 27001:2022 — A.9.2.6 (Removal or adjustment of access rights)
- HIPAA — §164.308(a)(3)(ii)(C) (Termination procedures for PHI access)

---

*Last reviewed: 2026-04-20.*
