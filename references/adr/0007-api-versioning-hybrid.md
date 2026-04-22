# 0007 — API versioning — URL-based majors + dated header minors, tRPC unversioned

- **Status**: Accepted
- **Date**: 2026-04-20
- **Deciders**: @HarshadBhoi
- **Consulted**: External domain review (Google Gemini, April 2026)
- **Informed**: engineering, product
- **Tags**: #api #versioning #integrations

---

## Context

AIMS v2 exposes two API surfaces: an internal tRPC surface between the Next.js frontend and the Fastify request-path service, and a public REST API (OpenAPI 3.1) for external integrators.

The internal tRPC surface is contractually straightforward. We own both sides; a Zod-schema snapshot test in CI catches any breaking change at build time; there is no need to version the tRPC procedures externally.

The **public REST API is different.** Once an integrator builds an automation against `/v1/engagements`, they will expect that endpoint to continue working the way it did when they built it. Breaking changes are expensive for integrators and politically painful for us. Non-breaking additions are the common case. A versioning strategy must support both without turning every additive change into a URL bump.

The original "what's not in this doc" section of [docs/06-design-decisions.md](../../docs/06-design-decisions.md) deferred this decision to "when we cut v2." External domain review in April 2026 correctly pushed back: retrofitting versioning after a public API is in customer hands is substantially harder than designing it in. Stripe, Twilio, GitHub — all the high-quality B2B API providers — versioned their public APIs from day one.

This decision must be made before the first external integrator builds against `/v1/`.

---

## Decision

The public REST API uses a **hybrid versioning scheme**:

- **URL-based major versions** (`/v1/`, `/v2/`) for hard breaking changes. Semantically different endpoints, fundamentally different request/response shapes, contracts we cannot transparently migrate. Major versions happen rarely — ideally every 2-3 years at most.
- **Dated header-based minor versions** (`Api-Version: 2026-04-20` request header, Stripe's pattern) within a major. Each dated version is a frozen snapshot of the API's response-shape and semantics as of that date. Subsequent changes within the major version apply only if the integrator opts into a newer date. Additive, non-breaking changes become available to new integrators without forcing existing ones to migrate.

Integrators who don't send `Api-Version` receive the oldest active version within the major (conservative default — they get stable behaviour regardless of when they built against the API).

The internal tRPC surface is **not versioned.** We own both sides; Zod snapshot tests catch breaking changes; any cross-package changes go through normal CI. Integrators never touch tRPC directly; the REST layer is the public contract.

Behind the versioning layer is a **response-shape compatibility shim**: a per-version rendering function that takes the current data model and produces the response shape as it existed at the integrator's pinned date. The shim is explicit, testable, and lives in `api/requests/rest/versioning/` with one file per dated version.

A **deprecation policy** governs how we sunset old dated versions: each dated version gets a minimum 18-month support window after it stops being the default; customers using a deprecated version receive `Deprecation` and `Sunset` response headers (RFC 8594) with the sunset date; aged-out versions are removed from the compatibility shim in a scheduled release.

---

## Alternatives considered

### Option A — URL-only versioning (`/v1/`, `/v2/`)  (rejected)

Standard REST practice: every breaking change gets a new major version in the URL.

**Pros**
- Simplest conceptual model; well-understood by most API consumers
- Easy to document and communicate
- No request-header logic

**Cons**
- Any additive change that subtly shifts response shape (new field, reformatted date, extended enum) is either declared non-breaking (risky — some clients parse strictly) or forced into a new major version (expensive)
- Integrators end up stuck on old majors indefinitely, creating a de-facto multi-major support burden
- Forces platforms to either cut majors too often (integrator friction) or too rarely (technical debt)

### Option B — Header-only dated versioning (pure Stripe model)  (rejected)

No URL version at all; everything is `Api-Version: YYYY-MM-DD`.

**Pros**
- Finest-grained versioning; every change point can have its own dated version
- Integrators can pin very precisely

**Cons**
- Loses the clarity of "major version" as a concept; communicating hard breaking changes requires convention ("the 2028-03-15 version is a major rewrite") rather than structure
- No visual distinction in URL between v1 and v2 resources
- Harder to reason about URL-based caching, routing, and documentation organisation

### Option C — Hybrid: URL majors + dated header minors  (chosen)

The Stripe + GitHub synthesis: URL `v1/` for the major, dated header for within-major evolution.

**Pros**
- URL structure cleanly signals hard breaks (we'd go to `/v2/` only if the API is fundamentally different)
- Header dates allow arbitrarily fine-grained additive evolution within a major
- New integrators automatically get the latest dated version within a major; old integrators stay pinned
- Matches how the most mature B2B APIs in the industry (Stripe, GitHub, Twilio, Linear) actually work
- Deprecation signalling (`Deprecation` / `Sunset` headers per RFC 8594) is a natural fit

**Cons**
- Requires the response-shape compatibility shim in `api/requests/rest/versioning/` — nontrivial engineering to build and maintain
- Two concepts for integrators to learn (URL version and header date)
- Compatibility shim must be exercised for every release; any untested-version code path is a hidden bug

### Option D — Semver in URL (`/v1.2.3/`)  (rejected)

Full semantic versioning in the URL path.

**Pros**
- Most granular URL-visible versioning

**Cons**
- Minor URL churn forces integrators to update URLs for additive changes (defeating the purpose of minor versions)
- Caching and routing get messy
- Nobody does this for good reason

---

## Consequences

### Positive
- Matches B2B API industry best practice; integrators from Stripe / GitHub / Twilio backgrounds will find it familiar
- Clear separation between hard breaks (URL bump, infrequent) and additive evolution (header date, frequent)
- Deprecation signalling via RFC 8594 headers gives integrators machine-readable warning before sunset
- New integrators get the freshest contract automatically; old integrators stay stable — aligns incentives between platform velocity and customer stability
- tRPC surface stays unversioned; internal frontend/backend evolution pays no versioning tax

### Negative
- Response-shape compatibility shim is real engineering — must be built, tested per version, maintained over time
- Shim complexity grows with the number of active dated versions
- Integrator documentation must cover both URL version and header date
- Missing `Api-Version` header defaulting to "oldest active" is a policy choice with trade-offs (predictability wins over freshness)
- Adding a new dated version requires updating docs, adding shim code, testing the full matrix

### Neutral
- The `/v1/` URL is the stable entry for the life of the v1 contract
- Header is case-insensitive per HTTP convention; documented as `Api-Version: YYYY-MM-DD` (ISO 8601 date)
- Unknown or invalid header values return HTTP 400 with a machine-readable error identifying the valid versions
- Deprecation lead time: 18 months minimum between "deprecated" announcement and "removed"
- OpenAPI spec is versioned per date — we publish a distinct OpenAPI document per dated version

---

## Validation

- **Integrator adoption** — if new integrators consistently forget to set `Api-Version`, the default behaviour (oldest active within major) is the right choice; if they consistently pin without prompting, the header is working.
- **Shim correctness** — automated tests exercise every dated version's response shape against every endpoint; a PR that breaks any version's expected shape is a CI failure.
- **Deprecation adoption** — monitor how many integrators remain on a deprecated dated version as its sunset approaches; if significant, extend the sunset window or invest in migration tooling.
- **Major-version need** — if within 2-3 years we find ourselves wanting to bump to `/v2/`, the scope of the break will reveal whether our majors are rare enough (good) or whether we're avoiding majors for reasons that produce technical debt (bad).

---

## Rollout plan

- **Phase 1 — Scaffold before first public release** (pre-launch): implement the versioning layer in `api/requests/rest/versioning/` with one dated version as the initial release (`Api-Version: 2026-04-20` as the launch version); all endpoints live at `/v1/`; header default is the launch date.
- **Phase 2 — First additive change** (post-launch, first release adding a non-breaking field or enum): cut a new dated version (`Api-Version: 2026-07-15` or similar); shim renders old requests in the old shape; new integrators opt into the new date; docs describe the change.
- **Phase 3 — First deprecation** (18+ months post-launch): `2026-04-20` version is marked deprecated with a sunset date 18 months out; `Deprecation` / `Sunset` response headers start appearing for integrators still pinned to it; documentation migration guide is published.
- **Phase 4 — First sunset** (at the announced sunset date): `2026-04-20` version is removed from the compatibility shim; integrators still pinned receive a `410 Gone` response directing them to migrate.

---

## Threats considered

- **Integrator uses an outdated version indefinitely, accumulating technical debt on our side** — mitigated by the 18-month deprecation policy: the contract with integrators says they must migrate within 18 months of deprecation, giving them ample time while preventing infinite support obligations.
- **Shim drift — a dated version's rendering stops matching what we promised** — mitigated by snapshot tests: every dated version has a frozen set of example request/response pairs; any change that breaks a snapshot is a CI failure unless explicitly updating the snapshot (which requires a security-reviewer approval).
- **Malicious or buggy integrator sends headers designed to probe version behaviour (`Api-Version: 9999-01-01`)** — mitigated by strict validation: the server knows the list of valid dated versions; anything outside returns 400 with the valid list.
- **Race condition between a URL version and a header-date expectation** — not a real threat in practice since URL version fixes the major and header date only operates within a major; the shim is scoped per URL version.

---

## References

- [`docs/06-design-decisions.md` §3.9 — API versioning narrative](../../docs/06-design-decisions.md#39-api-versioning--url-based-majors--dated-header-minors-tRPC-unversioned)
- Gemini domain review, April 2026 (R1 on 06-design-decisions.md)
- Stripe API versioning documentation — the canonical implementation of this pattern
- GitHub REST API versioning — `X-GitHub-Api-Version` header (similar pattern, different header name)
- RFC 8594 — `Deprecation` and `Sunset` HTTP headers
- OpenAPI Specification 3.1 (the spec format we publish per version)
- Related ADRs: [ADR-0003](0003-nestjs-scoped-to-workers.md) (the Fastify request path hosts the REST layer + versioning shim)

---

<!--
CHANGELOG:
- 2026-04-20: Proposed by @HarshadBhoi following external domain review
- 2026-04-20: Accepted by @HarshadBhoi
-->
