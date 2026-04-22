# CI / CD

> GitHub Actions pipelines: pull request checks, preview environments, staging auto-deploy, production gated deploys. OIDC to AWS — zero long-lived cloud credentials.

---

## 1. Pipeline Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Developer pushes branch → opens PR                          │
├──────────────────────────────────────────────────────────────┤
│  CI workflow (ci.yml) runs:                                  │
│    ├─ lint          (all packages, turbo cache)              │
│    ├─ typecheck                                              │
│    ├─ unit tests    (vitest, parallel by package)            │
│    ├─ build         (next, nest, packages)                   │
│    ├─ bundle check  (frontend budgets)                       │
│    ├─ SAST          (Semgrep, CodeQL)                        │
│    ├─ SCA           (pnpm audit, Snyk)                       │
│    ├─ IaC scan      (tfsec, checkov — if terraform/ touched) │
│    ├─ secret scan   (gitleaks on diff)                       │
│    ├─ container scan(Trivy — if Dockerfile touched)          │
│    └─ preview env   (deploy to preview/pr-<n>.aims.io)       │
├──────────────────────────────────────────────────────────────┤
│  E2E smoke tests run against preview env                     │
├──────────────────────────────────────────────────────────────┤
│  Reviewer approves, checks green, merge to main              │
├──────────────────────────────────────────────────────────────┤
│  cd-staging.yml runs:                                        │
│    ├─ build + push images (ECR)                              │
│    ├─ helm upgrade to staging cluster                        │
│    ├─ DB migration (if present, with safety check)           │
│    ├─ smoke tests against staging                            │
│    └─ notify Slack                                           │
├──────────────────────────────────────────────────────────────┤
│  Release manager triggers cd-production.yml:                 │
│    ├─ ─required approvals (2 humans)                         │
│    ├─ change record auto-filed (ServiceNow / Linear)         │
│    ├─ canary deploy (1% traffic via Argo Rollouts)           │
│    ├─ health-check gate (5 min observation)                  │
│    ├─ staged promote (5% → 25% → 100%)                       │
│    ├─ smoke tests at each stage                              │
│    └─ notify + tag release                                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Workflow Files

### Pull Request (`.github/workflows/ci.yml`)
Runs on `pull_request` to any branch targeting `main`.

**Jobs (run in parallel where possible):**

| Job | Runs on | Gates merge? |
|-----|---------|--------------|
| `setup` | ubuntu-24.04 | — (installs deps, cached) |
| `lint` | ubuntu-24.04 | Yes |
| `typecheck` | ubuntu-24.04 | Yes |
| `test-unit` | ubuntu-24.04 (matrix by package) | Yes |
| `test-component` | ubuntu-24.04 | Yes |
| `build` | ubuntu-24.04 | Yes |
| `bundle-budget` | ubuntu-24.04 | Yes |
| `a11y` | ubuntu-24.04 | Yes |
| `sast` | ubuntu-24.04 | Yes (medium+ blocks) |
| `sca` | ubuntu-24.04 | Yes (high+ blocks, exceptions via allowlist) |
| `secret-scan` | ubuntu-24.04 | Yes (any finding blocks) |
| `iac-scan` | ubuntu-24.04 | Conditional — only if `terraform/**` changed |
| `container-scan` | ubuntu-24.04 | Conditional — only if `docker/**` changed |
| `preview-deploy` | ubuntu-24.04 | No (advisory; blocks next job only) |
| `e2e-smoke` | ubuntu-24.04 | Yes (6 critical flows) |

**Concurrency**: Max one run per PR — push cancels in-flight. Saves CI minutes.

**Timing target**: < 12 min end-to-end on warm cache. CI cost budget: < $300/month at 50 PRs/week.

### Merge to `main` (`.github/workflows/cd-staging.yml`)
Runs on `push` to `main`.

**Jobs:**
1. Rebuild images with `:main-<sha>` tag → push to ECR
2. Run database migration dry-run against staging; report diff
3. Approve migration (auto if "safe"; manual if "unsafe" — see §6)
4. `helm upgrade` web/api/worker to staging
5. Wait for rollout (pods ready + health endpoints green)
6. Run E2E suite against staging (~30 min full suite — async reported)
7. Tag git: `staging-<timestamp>`

### Production Deploy (`.github/workflows/cd-production.yml`)
**Trigger**: `workflow_dispatch` only (manual — human intent required). Inputs: release tag (`v1.2.3`), rollout type (`standard` / `hotfix`), change-ticket URL.

**Gates:**
- [x] 2× human approval via GitHub Environments (`production` env requires reviewers)
- [x] Release tag matches a tested staging build (min 24h in staging)
- [x] Change window check — fails if outside Tuesday/Thursday 10–14 UTC unless `hotfix`
- [x] ServiceNow / Linear change record referenced in inputs
- [x] Current SLO burn rate is not critical (queries Prometheus; aborts if error budget exhausted)

**Deploy pattern**: Argo Rollouts canary
1. Deploy to 1% of replicas → observe 5 min → abort if SLO degrades
2. Promote to 5% → observe 5 min
3. Promote to 25% → observe 10 min
4. Promote to 100%
5. Tag git: `v1.2.3-prod-<timestamp>`; update Sentry release; notify Statuspage

Rollback: `argocd rollout undo` — one command. < 60 seconds to previous version.

### Nightly (`.github/workflows/nightly.yml`)
Runs at 03:00 UTC:
- Full E2E suite (all browsers)
- Full Lighthouse CI
- Dependency freshness report
- Drift detection: `terraform plan` on every env; alert if drift detected
- License compliance check
- Cost explorer snapshot

### Scheduled DR Drill (`.github/workflows/dr-drill.yml`)
Runs first Saturday of each quarter:
- Restore latest backup to `dr` cluster
- Run validation scripts (row counts, schema, checksum)
- Measure RTO → report
- Automatic PR to update `DISASTER-RECOVERY.md` with results

---

## 3. OIDC to AWS (No Long-Lived Keys)

GitHub Actions authenticates to AWS via OIDC — each job gets a short-lived STS token scoped to the role it needs. Long-lived IAM access keys **never exist in GitHub secrets**.

### Setup (once, per AWS account)
```hcl
# terraform/bootstrap/github-oidc.tf
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}
```

### Per-environment roles
| Role | Trust policy | Permissions |
|------|--------------|-------------|
| `github-ci-read-dev` | Any branch in repo | ECR pull, S3 test bucket, CloudWatch put |
| `github-deploy-staging` | `main` branch only | ECR push, EKS deploy (staging cluster), Secrets read, Route53 change |
| `github-deploy-production` | `v*` tags only, `workflow_dispatch` only | Same but production cluster; tighter scope |
| `github-terraform-plan` | Any branch | Read-only on all envs |
| `github-terraform-apply` | `main` branch only, `workflow_dispatch` | Full apply on dev; manual-gated apply on staging/prod |

Trust policy restricts to **specific repo + branch/tag** so a fork or forked PR can't assume the role:
```json
{
  "StringLike": {
    "token.actions.githubusercontent.com:sub": "repo:acme-aims/aims-v2:ref:refs/heads/main"
  }
}
```

### Usage in workflow
```yaml
permissions:
  id-token: write    # required for OIDC
  contents: read

jobs:
  deploy:
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/github-deploy-staging
          aws-region: us-east-1
```

---

## 4. Caching Strategy

### pnpm Store
```yaml
- uses: pnpm/action-setup@v3
  with: { version: 9 }
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: pnpm
```

### Turborepo Remote Cache
Self-hosted on S3 (avoid vendor lock-in):
```yaml
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: aims-v2
  TURBO_API: https://turbo-cache.internal.aims.io
```

Hit rate target > 60% on `lint`, `typecheck`, `build`. Measured via Turbo summary.

### Docker Buildx Cache
```yaml
- uses: docker/build-push-action@v5
  with:
    cache-from: type=registry,ref=ecr.amazonaws.com/aims/api:buildcache
    cache-to: type=registry,ref=ecr.amazonaws.com/aims/api:buildcache,mode=max
```

### Playwright Browsers
Cached separately from pnpm store (large binary):
```yaml
- uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ hashFiles('pnpm-lock.yaml') }}
```

---

## 5. Preview Environments

Every PR gets its own preview at `pr-<n>.preview.aims.io`. Uses `dev` cluster with isolated namespace:

```
dev-cluster/
├── namespace: pr-123
│   ├── web (image: :pr-123-<sha>)
│   ├── api (image: :pr-123-<sha>)
│   └── worker (image: :pr-123-<sha>)
├── cert: *.preview.aims.io (wildcard via cert-manager)
├── db: shared preview DB with per-PR schema (pr_123)
├── redis: namespaced keys (pr-123:...)
└── s3: shared bucket, prefix-isolated (s3://aims-preview/pr-123/)
```

### Creation
- Triggered from `ci.yml` after build passes
- Helm release named `pr-<n>`
- DB schema migrated from latest main + PR's migrations
- Seeded with test tenant + fixtures

### Teardown
- GitHub Actions job on PR close/merge deletes the helm release, schema, S3 prefix
- Nightly sweep removes stale previews (> 7 days with no activity)

### Cost control
- Preview pods sized small (100m CPU, 256Mi RAM)
- Max 30 concurrent previews per account (queue if over)
- Excluded from SLO monitoring (not customer-facing)

---

## 6. Database Migration Safety

### Migration classification
Each migration file is classified at merge time via static analysis (`scripts/analyze-migration.ts`):

| Class | Examples | Allowed when |
|-------|----------|--------------|
| **Safe** | `CREATE TABLE`, `CREATE INDEX CONCURRENTLY`, adding nullable column | Auto-deploy to staging + prod |
| **Ambiguous** | Renaming column, changing type, making column NOT NULL | Manual review + runbook required |
| **Unsafe** | `DROP TABLE`, `DROP COLUMN`, locking changes to large tables | Block; needs multi-step migration plan |

### Migration workflow
1. Developer writes migration in `database/migrations/`
2. CI runs classifier → comments on PR with class + warnings
3. If `Unsafe`, PR is blocked until broken into safe steps (expand → migrate → contract)
4. On deploy: migration runs in transaction; dry-run shows affected rows
5. Post-migration smoke test verifies app still responds

### Expand–Migrate–Contract pattern
For unsafe changes, enforced via CI checklist:
- **Expand PR**: add new schema (nullable); deploy
- **Migrate PR**: backfill + dual-writes; deploy; monitor
- **Contract PR**: drop old schema; deploy

Never one PR for all three.

### Locking protection
`statement_timeout` set aggressively in migrations (10s default). Lock conflicts abort migration, report, rollback.

---

## 7. Secrets in CI

### What goes in GitHub Secrets (repo-level)
- `AWS_ACCOUNT_ID` (not a secret per se, but convenient)
- `CODECOV_TOKEN`, `SENTRY_AUTH_TOKEN`, `SNYK_TOKEN`
- `SLACK_WEBHOOK_URL` (deploy notifications)

### What goes in GitHub Environments (per-env)
- Nothing — all app secrets pulled from AWS Secrets Manager at runtime via IRSA
- Environment "reviewers" list (for approval gates)
- Environment "deployment branches/tags" restriction

### What does NOT go in GitHub at all
- Database credentials
- Cloud access keys (use OIDC)
- API keys for prod services
- Customer data

`gitleaks` runs pre-commit (via husky) and in CI. If a secret is detected, merge blocks immediately + Security team paged + key rotation runbook fires.

---

## 8. Required & Recommended Status Checks

### Required (merge blocked if red)
- `lint`
- `typecheck`
- `test-unit`
- `test-component`
- `build`
- `bundle-budget`
- `sast`
- `sca` (high+ only)
- `secret-scan`
- `e2e-smoke`
- 1× PR review approval (2× for `infra/`, `migrations/`)

### Recommended (red shows warning but doesn't block)
- `a11y` (zero violations targeted)
- `preview-deploy`
- `full-lighthouse`

Branch protection on `main`:
- No direct pushes
- Linear history (rebase or squash only)
- Require up-to-date branch before merge
- Dismiss stale approvals on new commits
- Require conversation resolution

---

## 9. Reusable Workflows

Shared workflows in `.github/workflows/reusable/`:

| File | Purpose |
|------|---------|
| `setup.yml` | Install pnpm, Node, cache |
| `build-and-push-image.yml` | Buildx + sign (cosign) + push to ECR + SBOM |
| `helm-deploy.yml` | Parameterized helm upgrade with health check |
| `run-migration.yml` | Run Prisma migrate with safety checks |
| `argocd-rollout.yml` | Canary + auto-abort on SLO breach |
| `smoke-test.yml` | Synthetic check suite |

All deploys for all envs use these — so deploy logic is defined in one place.

---

## 10. Signed Artifacts

Every container image is signed with `cosign` using keyless (Sigstore) signing tied to the GitHub workflow:

```yaml
- uses: sigstore/cosign-installer@v3
- run: cosign sign --yes ecr.aws/aims/api:${{ github.sha }}
```

Policy in EKS admission controller (Kyverno or Connaisseur) rejects unsigned images. Supply chain attack → image cannot deploy.

SBOM (Software Bill of Materials) generated via `syft` and attached to image + stored in S3 for compliance evidence:
```yaml
- run: syft ecr.aws/aims/api:${{ github.sha }} -o spdx-json > sbom.json
- run: cosign attest --predicate sbom.json --type spdx ecr.aws/aims/api:${{ github.sha }}
```

---

## 11. Artifact & Image Promotion

Build once, promote many. Same image that passes staging promotes to production — never rebuild.

```
PR build:     ecr.aws/aims/api:pr-123-abc1234
After merge:  ecr.aws/aims/api:main-def5678
Staging tag:  ecr.aws/aims/api:staging-20260419  (ALIAS to :main-def5678)
Release tag:  ecr.aws/aims/api:v1.2.3           (ALIAS after release cut)
Prod deploy:  pulls ecr.aws/aims/api:v1.2.3
```

No rebuild between staging and prod ensures bit-for-bit identical artifacts.

---

## 12. Change Management Integration

Production deploys emit a structured change record to ServiceNow (or Linear):
- Title: `Deploy v1.2.3 to production`
- Risk: calculated from migration class + recent error rate
- Rollback plan: link to rollback runbook + current version tag
- Approvers: names from GitHub Environment approval
- Result: updated post-deploy (success / rolled back) with metrics link

This satisfies SOC 2 CC6 / CC8 change management control.

---

## 13. Notifications

| Event | Channel | Audience |
|-------|---------|----------|
| CI failure on `main` | `#ci-alerts` Slack | Engineering |
| Staging deploy success | `#deploys` Slack | Engineering |
| Staging deploy failure | `#ci-alerts` + page on-call | SRE |
| Production deploy started | `#deploys` + Statuspage "maintenance" | Customers + internal |
| Production deploy success | `#deploys` + Statuspage resolved | Customers + internal |
| Production deploy rollback | `#incidents` + page on-call | SRE + Eng Leadership |
| Drift detected overnight | `#platform` | Platform team |

---

## 14. What We Measure About CI/CD

DORA metrics tracked in Grafana via GitHub API + deploy logs:

| Metric | Target | Current |
|--------|--------|---------|
| Deploy frequency | Daily (to prod) | TBD |
| Lead time for changes (commit → prod) | < 48 h | TBD |
| Change failure rate | < 5% | TBD |
| Mean time to restore (MTTR) | < 1 h | TBD |
| Build time (CI total) | < 12 min | TBD |
| Test flakiness | < 0.5% | TBD |

Monthly review; actions taken on sustained regression.

---

## 15. Disallowed Patterns

- ❌ Long-lived AWS access keys in GitHub secrets
- ❌ Production deploys without human approval
- ❌ Deploying code that hasn't spent 24h in staging (non-hotfix)
- ❌ `terraform apply` from laptop — all apply through CI
- ❌ Skipping tests with `test.skip` and merging (gitleaks-style check for this)
- ❌ Using `:latest` image tags in production (must be immutable tag)
- ❌ Unsigned images reaching prod cluster
- ❌ CI jobs that take > 30 min (split or optimize)
- ❌ Self-hosted runners for building prod images unless bastion-isolated
- ❌ Running migrations outside the pipeline (must go through `run-migration.yml`)

---

## 16. Related Documents

- [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) — what Terraform actually provisions
- [`ENVIRONMENTS.md`](ENVIRONMENTS.md) — what dev/staging/prod look like
- [`SECRETS.md`](SECRETS.md) — how CI gets secrets at runtime
- [`RELEASE.md`](RELEASE.md) — canary, feature flags, rollback
- [`../api/ARCHITECTURE.md`](../api/ARCHITECTURE.md) — the service CI builds
