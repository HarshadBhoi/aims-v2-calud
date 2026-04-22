# Release Management

> Semantic versioning, conventional commits, canary deploys via Argo Rollouts, feature flags, one-command rollback. Deploy frequently, safely, observably.

---

## 1. Release Philosophy

- **Small, frequent releases** beat large, infrequent ones. Smaller = easier rollback, faster MTTR, less risk per deploy.
- **Deploy ≠ release.** Deploy puts code in production; feature flags control when users see it.
- **Build once, promote many.** Same image hash traverses dev → staging → prod.
- **Every deploy is observable.** Release annotations appear on Grafana panels + Sentry releases.
- **Rollback is a first-class action**, not a rare emergency. Practice it.

---

## 2. Versioning

### Application Versioning — Semantic (SemVer 2.0)
`MAJOR.MINOR.PATCH` — e.g., `v1.2.3`.

- **MAJOR** — breaking API/contract change (tRPC router input/output change that requires client update)
- **MINOR** — backwards-compatible feature added
- **PATCH** — backwards-compatible bug fix

Pre-release: `v1.2.3-rc.1` (staging-only), `v1.2.3-hotfix.1` (emergency).

### Internal API — Additive
We control both client (Next.js) and server (NestJS). In theory breaking changes are safe. In practice, preview environments and brief staging overlap demand additive changes for transition.

### Standard Pack Versioning — Independent
Standard packs (`data-model/`) version separately with their own SemVer: `gagas-2024.v1.0.0`. Pack schema backward compatibility is its own discipline (see `data-model/VALIDATION.md`).

---

## 3. Branch & Commit Discipline

### Branch Model — Trunk-Based
- `main` is the trunk. Always deployable.
- Short-lived feature branches: `feat/finding-bulk-approve`, `fix/pdf-timeout`, `chore/bump-eslint`
- No long-running release branches; no `dev` branch
- Hotfix branches: `hotfix/urgent-auth-fix` — merge directly to `main` after normal CI

### Conventional Commits (enforced via commitlint)
```
<type>(<scope>): <short description>

<body>

<footer>
```

Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `test`, `build`, `ci`, `chore`, `revert`.

Breaking change: `feat!: ...` or `BREAKING CHANGE:` footer. Triggers MAJOR bump.

### PR Discipline
- Squash merge to `main` (one commit per PR — clean history)
- PR title = merge commit message (enforced by commitlint on PR title)
- Every PR has a linked issue/ticket or is explicitly scoped in the description
- PRs > 400 lines require extra reviewer

---

## 4. Version Bumping & Changelog (Automated)

### Release Please / changesets
On every merge to `main`:
- Release Please (Google) analyzes commits since last release
- Opens / updates a PR titled `chore(main): release v1.2.4` that:
  - Bumps version in `package.json` files
  - Generates `CHANGELOG.md` entries (grouped by type, with PR links)
- Merging that PR:
  - Creates git tag `v1.2.4`
  - Creates GitHub Release with changelog body
  - Triggers `cd-production.yml` (manual approval still required)

Never manual version bumps. The tool is the truth.

### Changelog Format
```markdown
## [1.2.4](https://github.com/.../compare/v1.2.3...v1.2.4) (2026-04-19)

### Features
* **finding:** bulk approve up to 50 findings (#1234)
* **pdf:** support landscape orientation for wide tables (#1256)

### Bug Fixes
* **auth:** MFA code entry loses focus on paste (#1289)
* **upload:** retry 5xx responses up to 3 times (#1290)

### Performance
* **api:** tRPC batching reduces payload ~30% (#1301)
```

---

## 5. Feature Flags

### Why Flags
- **Decouple deploy from release**: ship code safely; turn on when ready
- **Ramp rollout**: 1% → 10% → 100%
- **Kill switch**: disable a feature without a deploy
- **A/B test**: measure impact
- **Targeted enablement**: enable for beta tenants, internal users, specific regions

### Flag Types

| Type | Example | Lifetime |
|------|---------|----------|
| **Release flag** | New finding creation wizard | 14–90 days (until fully rolled out) |
| **Experiment flag** | New dashboard layout | Length of experiment + cleanup |
| **Ops flag (kill switch)** | Disable PDF generation during outage | Long-lived (evergreen) |
| **Permission flag** | Enable early-access feature per tenant | As long as tier/plan exists |
| **Debug flag** | Extra logging for one tenant | Session or until resolved |

### Tooling — OpenFeature + LaunchDarkly (or Flagsmith self-hosted)
- OpenFeature SDK in code (vendor-neutral API)
- LaunchDarkly as provider for Phase 1 (great developer experience, reliable)
- Evaluation: rules eval on client + server; server always authoritative on security-relevant flags

### Flag Naming
```
{area}.{feature}.{variant}
```
Examples:
- `finding.bulk-approve.enabled` (boolean)
- `ui.new-dashboard.variant` (string: `current`, `v2`, `v3`)
- `pdf.landscape.enabled` (boolean)

### Targeting Rules
Typical rule stack:
1. Is tenant in `ops-kill-switch-list`? → OFF
2. Is tenant flagged `beta`? → ON
3. Is user flagged `internal`? → ON
4. Random 10% rollout? → variant A
5. Else → OFF

### Flag Cleanup — 90-Day SLA
- New flag PR must include a removal tracking issue
- 60 days after full rollout: CI warns
- 90 days: CI fails (blocks merges touching that flag file)
- Removed flag = PR to delete code paths guarded by it
- Old flags rot — they accumulate technical debt

---

## 6. Deploy Strategies

### Per-Environment Strategy

| Env | Strategy | Approval |
|-----|----------|----------|
| Preview | Recreate (fresh pods) | PR CI |
| Dev | RollingUpdate | Auto on merge |
| Staging | RollingUpdate + auto-soak | Auto on merge |
| Production | **Argo Rollouts canary** | 2× human + change window |

### Argo Rollouts Canary (Production)

```
Time 0:   deploy v1.2.4 image; 1 canary pod gets 1% of traffic
Time 5m:  analysis (error rate, p99 latency) — if OK, proceed
Time 5m:  bump to 5% traffic (scale canary)
Time 10m: analysis again
Time 10m: bump to 25% traffic
Time 20m: analysis
Time 20m: promote to 100%
Time 25m: cleanup old ReplicaSet
```

Any analysis failure → auto-rollback (traffic flips back to stable, canary pods drained).

### Analysis Templates (SLO-gated)
Already defined in `CONTAINERS.md §9`. Summary:
- Error rate (5xx) < 1% — fail if exceeded
- p99 latency < 800 ms — fail if exceeded
- Saturation (CPU) < 80% — fail if exceeded (hints at load test failure)

### Blue/Green (reserved for major changes)
For changes to DB that need careful validation (rare — normally additive migrations avoid this):
- Deploy new version to parallel "green" stack
- Run full E2E against green
- Flip DNS / ingress to green (atomic)
- Keep blue running for 1h as fallback
- Decommission blue

Takes longer + uses more resources than canary — reserve for high-risk changes.

---

## 7. Rollback

### Rollback Target Time: < 5 minutes (from decision to served)

### Rollback Mechanisms (layered — use the simplest that works)

| Mechanism | When | Time |
|-----------|------|------|
| **Feature flag off** | Feature-specific regression | Seconds |
| **Argo Rollout undo** | Application regression during rollout | < 60 s |
| **Argo sync to previous git SHA** | Post-rollout regression | 2–5 min |
| **Argo app revert (manual)** | Emergency; UI-driven | 2–5 min |
| **Scale to zero + maintenance page** | Truly catastrophic | < 30 s (CloudFront static) |
| **DB migration rollback** | Ambiguous migration broke app | Runbook-specific; minutes |
| **Regional DNS failover** | Regional outage | 60 s TTL + propagation |

### Rollback Commands

```bash
# Revert canary during rollout
kubectl argo rollouts undo api -n aims

# Full app revert to previous git SHA
argocd app set aims-v2-prod-us --revision <previous-sha>
argocd app sync aims-v2-prod-us

# Emergency scale to zero + flash maintenance page
kubectl scale deploy/web -n aims --replicas=0
# (CloudFront custom error page serves meanwhile)

# Re-enable after fix
argocd app sync aims-v2-prod-us
kubectl scale deploy/web -n aims --replicas=4
```

### Rollback Post-Actions
Every rollback triggers:
1. Statuspage update ("investigating" → "monitoring" → "resolved")
2. Incident channel in Slack
3. Postmortem within 5 business days (blameless)
4. Customer comms if impact > 15 min or > 10% of tenants

---

## 8. Database Migrations & Releases

### The Expand → Migrate → Contract Pattern
Any schema change that's not purely additive splits into 3 deploys:

**Deploy 1 (Expand)**: add new column / table / index; nullable; code still uses old schema. Ship.
**Deploy 2 (Migrate)**: backfill data; code dual-writes + reads from new; confirm parity. Ship.
**Deploy 3 (Contract)**: remove old column; code only uses new. Ship.

Never combine steps. Ever.

### Migration & App Version Compatibility
- App release N must be compatible with migration version N AND N-1
- On deploy: migration runs first (pre-install Helm hook); app rolls out second
- If app rolls back, its schema is still N (fine — app N-1 must still work with schema N)

### Unsafe Migration Classification
CI classifies migrations (see `CI-CD.md §6`). Unsafe migrations are rejected; must be split into safe expand-migrate-contract PRs.

---

## 9. Release Cadence

| Release type | Cadence | Window |
|--------------|---------|--------|
| Regular | 2×/week | Tue + Thu, 10:00–14:00 UTC |
| Hotfix | As needed | Any time (extra approval) |
| Infra change | Weekly batch | Wed 14:00 UTC |
| DB migration (heavy) | Weekend coordinated | Saturday pre-dawn UTC |
| Security patch | Within SLA | Critical: 24h; High: 7d |

### Change Freeze Windows
- Fridays (no prod deploys)
- Week before US major holidays (Thanksgiving, Christmas, Independence Day) — many tenants close fiscal years
- Week before Australia/UK tax year ends
- Customer-specific freezes (declared in contract) — orchestrated via tenant-scoped feature flags + regional holds

---

## 10. Release Notes — Customer-Facing

Two audiences, two artifacts:

### Technical Release Notes (engineering)
`CHANGELOG.md` in repo — detail, PR links, internal jargon fine.

### Product Release Notes (customers)
`docs/release-notes/YYYY-MM-DD.md` — curated, customer-friendly:
- What's new (features)
- What's improved (perf, UX)
- What's fixed (visible-to-customer bugs only)
- What's deprecated / coming soon
- Breaking changes (if any) with migration guidance

Product team curates from technical CHANGELOG + Linear. Published to `/docs/release-notes` + email to tenant admins opted-in.

---

## 11. Deploy Notifications & Observability

### Slack `#deploys` per deploy:
```
🚀 Production deploy v1.2.4 started (canary 1%)
   Initiator: @bob
   Change ticket: LIN-1234
   Migrations: safe (2 files)
   Diff: https://...
```

```
✅ Production v1.2.4 at 100% traffic. Soak 30m.
   Canary duration: 25 min
   No SLO breach.
```

### Release Annotations in Grafana
Every production deploy publishes a Grafana annotation with:
- Version tag
- Migration summary
- Link to changelog

Visible as vertical bars across all dashboards — instant correlation of metric changes with deploys.

### Sentry Release
Each deploy sends release info + source maps to Sentry. Regressions categorized by release tag.

### Statuspage
- Customer-visible during prod deploy: "Scheduled maintenance" banner for 30 min during canary window
- Auto-cleared after deploy succeeds

---

## 12. Progressive Rollout for Features (Beyond Deploys)

Even after code is fully deployed, features can roll out gradually:

1. **Deploy behind flag** (0% — code in prod, feature off)
2. **Enable for internal users** (`@aims-internal` tenant) — dogfood 1 week
3. **Enable for beta tenants** — 5–10 tenants, 2 weeks
4. **Enable for 10% of tenants** — monitor usage + errors
5. **Enable for 100%** of tenants on specific plans
6. **Remove flag** (code path merges)

Total 6–12 weeks for significant features. Worth it — catches issues in small blast radius.

---

## 13. Canary for Workers & Migrations

### Worker Canary
BullMQ workers processing specific job types can deploy new versions by:
- Single "canary worker" pod processes 1% of jobs (queue partitioning)
- Compare error rate / processing time vs stable workers
- Promote if green, revert if red

### Migration "Canary"
Not quite canaries — but: run ambiguous migrations in staging with a recent prod dump first. Time it. Measure locks. Only proceed to prod if green.

---

## 14. Supply-Chain / Artifact Security

### Signed Images
Every image signed via Cosign keyless. Kyverno admission controller rejects unsigned.

### SBOM Attached
Syft-generated SBOM attached to each image. Available for customer review on request (SOC 2 TSC 8.1).

### Provenance (SLSA level 3 target)
GitHub Actions generates build provenance → attached to image. Verifies "built in this repo, by this workflow, from this commit."

### Dependency Review
Dependabot + Snyk scan on every PR. PRs introducing high/critical CVEs blocked until updated.

---

## 15. Release Manager Role

Each sprint, one engineer is **Release Manager**:
- Monitors staging health
- Drives production deploys (executes the workflow, watches canary)
- Coordinates hotfixes
- Updates Statuspage for planned maintenance
- Publishes release notes to `#releases` Slack

Handover on Mondays. Check-in + runbook review each rotation.

---

## 16. Hotfix Protocol

Hotfixes (P1 bugs, security fixes) skip some gates but not quality:

1. Branch: `hotfix/short-description`
2. PR: full CI (no shortcut)
3. Min 2h in staging (vs normal 24h)
4. Approvals: **3×** (one must be VP Eng or designate)
5. Change record mandatory + escalated risk review
6. Deploy outside normal window if urgent
7. Post-deploy: immediate enhanced monitoring + backfill release notes + postmortem within 48h

No emergency "push to main and deploy" without this wrapper. The 15-minute speedup isn't worth the 15-day outage recovery.

---

## 17. What We Don't Do

- **No untested code in production** — even hotfixes go through CI
- **No manual deploys from laptops** — only via workflows
- **No "quick fix in prod and I'll backport"** — fix in branch, promote normally
- **No skipping staging** (except rare approved hotfix)
- **No deploys without feature flags for risky changes**
- **No permanent feature flags** (90-day SLA)
- **No mixed-version pods for long** (rolling updates complete quickly; canary bounded)
- **No silent deploys** — every deploy announces itself

---

## 18. DORA Metrics We Track

| Metric | Target | Elite |
|--------|--------|-------|
| **Deploy frequency** | Daily | Multiple/day |
| **Lead time for changes** | < 48 h | < 1 h |
| **Change failure rate** | < 10% | < 5% |
| **Mean time to restore** | < 1 h | < 1 h |

Dashboards in Grafana from GitHub API. Reviewed monthly. Regressions investigated.

---

## 19. Related Documents

- [`CI-CD.md`](CI-CD.md) — pipelines that drive releases
- [`CONTAINERS.md`](CONTAINERS.md) — Argo Rollouts, analysis templates
- [`ENVIRONMENTS.md`](ENVIRONMENTS.md) — promotion flow
- [`OBSERVABILITY.md`](OBSERVABILITY.md) — SLO-gated deploys + release annotations
- [`RUNBOOKS.md`](RUNBOOKS.md) — rollback runbook, hotfix runbook
- [`DISASTER-RECOVERY.md`](DISASTER-RECOVERY.md) — release-related failure modes
