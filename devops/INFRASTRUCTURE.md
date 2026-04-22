# Infrastructure

> Terraform-managed AWS infrastructure. Multi-region, multi-AZ, compliance-ready. State in S3 + DynamoDB. Zero click-ops.

---

## 1. Infrastructure as Code — Terraform

### Why Terraform over alternatives

| Tool | Chose? | Why / Why not |
|------|--------|---------------|
| **Terraform** / OpenTofu ✅ | Yes | Industry standard, multi-cloud, massive module ecosystem, strong state, HCL is readable, OpenTofu fork future-proofs us from HashiCorp license changes |
| Pulumi | No | TypeScript IaC is seductive but higher cognitive load for ops staff; state lock-in to Pulumi Cloud unless self-hosted |
| CDK | No | AWS-only; generates CFN (slower, less transparent); Go/TS complexity |
| CloudFormation | No | AWS-only, verbose YAML, painful state management |
| Ansible | No | Good for config management, not infrastructure provisioning |

**We use OpenTofu 1.7+** (Terraform-compatible fork). Binary compatible with `terraform` CLI; avoids license uncertainty. CI runs `tofu` but we'll say "terraform" colloquially.

### State Backend

```hcl
terraform {
  backend "s3" {
    bucket         = "aims-v2-tf-state-${env}"
    key            = "${component}/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    kms_key_id     = "alias/aims-tf-state"
    dynamodb_table = "aims-v2-tf-locks"
    use_lockfile   = true    # native S3 locking (no DDB needed on newer TF)
  }
}
```

- State encrypted at rest (KMS) and in transit (TLS)
- Versioning enabled on bucket; 90-day retention
- MFA Delete required
- Cross-region replication of state bucket (ensures DR)
- Access restricted to `github-terraform-*` roles + break-glass admin

### Module Structure

```
terraform/
├── bootstrap/                    # One-time: state backend, OIDC, org-wide IAM
│   ├── state-backend.tf
│   ├── github-oidc.tf
│   ├── org-sso.tf
│   └── break-glass.tf
├── modules/                      # Reusable modules
│   ├── network/                  # VPC, subnets, NAT, flow logs
│   ├── eks/                      # EKS cluster, node groups, addons
│   ├── rds/                      # PostgreSQL with Multi-AZ, PITR, replicas
│   ├── redis/                    # ElastiCache cluster
│   ├── s3-bucket/                # Encrypted bucket with lifecycle
│   ├── ecr-repo/                 # Image registry per service
│   ├── iam-role/                 # IRSA-ready roles
│   ├── secrets-manager/          # Secrets with auto-rotation
│   ├── kms-key/                  # CMK with rotation
│   ├── cloudfront/               # CDN for static + app
│   ├── waf/                      # WAFv2 rules
│   ├── route53-zone/             # DNS
│   ├── backup/                   # AWS Backup plan
│   └── monitoring/               # CloudWatch logs, alarms
├── environments/
│   ├── global/                   # Org-wide: Route53 parent zone, IAM baseline
│   ├── dev/
│   │   ├── us-east-1/
│   │   │   ├── main.tf           # Composes modules
│   │   │   ├── variables.tf
│   │   │   ├── outputs.tf
│   │   │   └── terraform.tfvars
│   │   └── eu-west-1/
│   ├── staging/
│   │   └── us-east-1/
│   └── production/
│       ├── us-east-1/
│       ├── eu-west-1/
│       └── ap-southeast-1/
└── policies/                     # OPA / Sentinel policies (optional)
```

### State File Layout
One state file per **environment × region × component**. Avoid monoliths that take 30 min to plan.

Components (separate state files):
- `network` (VPC, subnets) — rarely changes
- `platform` (EKS + addons) — changes monthly
- `data` (RDS, Redis, S3) — rare but critical
- `apps` (k8s app releases via Helm — Terraform deploys Helm)
- `observability` (Grafana, Prometheus)
- `dns` (Route53 records)

---

## 2. AWS Account Strategy

### Multi-Account (AWS Organizations)

| Account | Purpose | AWS account ID |
|---------|---------|----------------|
| `aims-management` | Org root, billing, IAM Identity Center, Control Tower | (mgmt) |
| `aims-log-archive` | Centralized logs (CloudTrail, VPC Flow, S3 logs) | (log) |
| `aims-audit` | Read-only cross-account audit/security | (audit) |
| `aims-shared-services` | ECR, CI runners, shared Route53, KMS CMK | (shared) |
| `aims-dev` | Dev environment | (dev) |
| `aims-staging` | Staging environment | (staging) |
| `aims-production-us` | Production US region | (prod-us) |
| `aims-production-eu` | Production EU region | (prod-eu) |
| `aims-govcloud` | Federal / DoD (Phase 4) | (govcloud, separate partition) |

Separation provides:
- **Blast radius containment** — dev experiments can't affect prod
- **Cost attribution** — per-account billing clean
- **Compliance scope** — prod accounts have stricter controls than dev
- **IAM boundary** — no cross-account implicit trust

### SSO (IAM Identity Center)
Single source of truth for human identity. Engineers sign in to SSO → select role → get short-lived STS token. No individual IAM users in member accounts.

Permission sets:
- `PowerUser-Dev` — broad dev access
- `ReadOnly-Staging` — default for everyone in staging
- `Operator-Staging` — limited-write operator role
- `ReadOnly-Production` — default
- `SRE-Production` — break-glass, time-bound via JIT
- `Auditor-All` — read-only cross-account

---

## 3. Networking

### VPC per Region per Environment

```
aims-production-us-east-1 VPC:
  CIDR: 10.20.0.0/16

  Availability Zones: us-east-1a, us-east-1b, us-east-1c

  Subnets (per AZ):
    Public:     10.20.{0,1,2}.0/24       (ALB, NAT)
    Private:    10.20.{10,11,12}.0/24    (EKS nodes, RDS, Redis)
    DB isolated:10.20.{20,21,22}.0/24    (RDS only, no internet)

  Routing:
    Public subnets   → IGW
    Private subnets  → NAT Gateway (one per AZ for HA)
    DB subnets       → No outbound; private endpoints only

  VPC Endpoints (no-internet for AWS services):
    s3, dynamodb (gateway)
    ecr.api, ecr.dkr, logs, secretsmanager, sts, kms (interface)

  Flow Logs → CloudWatch Logs → central log-archive account
```

### Public / Private Separation
- ALB in public subnets only
- EKS nodes in private subnets only
- RDS, ElastiCache in dedicated DB subnets (not even EKS can reach without SG permit)
- Bastion: **none** — use Session Manager (SSM) for any node access; no SSH ports open

### Security Groups
- Deny-all-inbound baseline
- SG-to-SG references (not CIDRs) where possible
- Egress restricted for sensitive tiers (DB SG has no internet egress)
- Terraform-managed; manual edits caught by drift detection

### Transit Between VPCs
- VPC peering for shared-services → dev/staging/prod (ECR pulls)
- Transit Gateway considered for Phase 3+ (>5 VPCs)
- No public peering across accounts

### WAF (WAFv2)
AWS Managed Rules enabled on ALB:
- `AWSManagedRulesCommonRuleSet` (OWASP top 10 basics)
- `AWSManagedRulesKnownBadInputsRuleSet`
- `AWSManagedRulesSQLiRuleSet`
- `AWSManagedRulesLinuxRuleSet`
- `AWSManagedRulesAmazonIpReputationList`

Custom rules:
- Rate limit: 2000 req / 5 min per IP (baseline)
- Rate limit: 200 req / 5 min per IP to `/api/auth/*` (auth abuse)
- Geo blocking: OFAC-sanctioned countries (updated from sanctions list)
- Challenge (CAPTCHA) for suspicious clients

Cloudflare in front of CloudFront (optional) provides additional DDoS + bot mitigation.

---

## 4. Compute — EKS (Kubernetes)

### Control Plane
- EKS 1.30+ (auto-updated by AWS; we track one version behind latest)
- Control plane logs → CloudWatch (audit, api, authenticator, controllerManager, scheduler)
- Control plane accessible only from authorized CIDR + private endpoint

### Node Groups

| Group | Instance type | Purpose | Autoscale |
|-------|---------------|---------|-----------|
| `system` | `m6i.large` (x3, one per AZ) | CoreDNS, ingress controller, cert-manager, otel-collector | 3–6 |
| `app` | `m6i.xlarge` | Web + API pods | 3–24 (based on requests) |
| `worker` | `c6i.xlarge` | BullMQ workers (CPU-bound: PDF, imports) | 2–12 |
| `batch` | `m6i.2xlarge` (spot) | Nightly analytics, DR drills | 0–8 |

- All nodes in private subnets
- Node AMI: EKS-optimized Bottlerocket (minimal attack surface, immutable)
- Node encryption: EBS at rest (KMS), root + data volumes
- Pods use IRSA (IAM Roles for Service Accounts) — no node-level AWS perms

### EKS Addons (managed)
- `vpc-cni` (networking)
- `kube-proxy`
- `coredns`
- `aws-ebs-csi-driver` (for stateful sets — rare)
- `eks-pod-identity-agent`
- `amazon-cloudwatch-observability`

### Cluster Add-ons (via Helm, managed by Terraform)
- **cert-manager** — automatic TLS via Let's Encrypt (and ACM fallback)
- **external-dns** — sync k8s Ingress to Route53
- **ingress-nginx** OR **AWS Load Balancer Controller** (we use ALB controller)
- **cluster-autoscaler** (or Karpenter — Phase 2)
- **metrics-server**
- **kyverno** (policy engine — enforces image signing, resource limits)
- **argocd** (GitOps for app deploys)
- **argo-rollouts** (progressive delivery)
- **velero** (backup namespace + PV states)

### Pod Security
- `PodSecurityAdmission` at `restricted` level on all user namespaces
- No privileged containers; no hostPath; no hostNetwork
- Non-root user required; read-only root filesystem enforced
- Resource requests + limits required on every pod (kyverno)

### Networking
- Calico for NetworkPolicy (default deny, explicit allow per service)
- ServiceMesh (Istio/Linkerd) deferred to Phase 2 when cross-service traffic patterns stabilize

---

## 5. Databases

### PostgreSQL — RDS (primary OLTP)

| Setting | Value | Why |
|---------|-------|-----|
| Engine | PostgreSQL 16.x | Modern, well-supported |
| Instance | `db.r6g.xlarge` (staging), `db.r6g.2xlarge` (prod) | Memory-optimized; adjust from metrics |
| Storage | `gp3`, 500 GB, autoscale to 2 TB | Cost-effective; iops decoupled from size |
| Multi-AZ | Enabled | Synchronous standby for HA |
| Backups | Automated 35-day retention | PITR within 5-min granularity |
| Cross-region backups | S3-replicated to EU (prod US) and vice-versa | DR |
| Encryption | KMS CMK (`aims-db-{env}`) | Compliance |
| Performance Insights | Enabled (7-day retention free tier) | Query tuning |
| Parameter group | Custom (`aims-pg16`): tuned work_mem, shared_buffers, logging | Production-grade defaults |
| Subnet group | DB subnets only | Network isolation |
| Security group | Only EKS `app` node SG allowed | Least privilege |
| Read replicas | 1× async (same region) + 1× cross-region for DR | Read scaling + DR |
| Deletion protection | Enabled (prod) | Accidental deletion |
| `log_min_duration_statement` | 1000 (ms) | Slow queries to CloudWatch |
| `pg_stat_statements` | Enabled | Query performance analysis |
| `pgaudit` | Enabled (log writes + DDL) | SOC 2 / HIPAA evidence |
| Maintenance window | Saturday 04:00–05:00 UTC | Low traffic |
| Minor version auto-upgrade | Enabled | Security patches |
| Major version | Manual, tested in staging first | Compatibility |

**PITR (Point-In-Time Recovery)** is our primary DR mechanism — see `DISASTER-RECOVERY.md`.

**Aurora option**: Evaluate for Phase 3 once scale demands it. Aurora adds cost; RDS sufficient for first 500 tenants.

### Redis — ElastiCache

| Setting | Value |
|---------|-------|
| Engine | Redis 7.2, cluster mode enabled |
| Node type | `cache.m6g.large` (dev), `cache.r6g.large` (prod) |
| Shards / replicas | 3 shards × 2 replicas (prod) |
| Multi-AZ | Yes (automatic failover) |
| Encryption in transit | TLS required |
| Encryption at rest | KMS |
| Snapshot | Daily, 7-day retention |
| Subnet group | Private subnets |
| Auth | Redis AUTH + IAM (for managed) |
| Eviction policy | `volatile-lru` — session/cache keys have TTL; expiring entries die first |

### S3 Buckets

| Bucket | Purpose | Lifecycle |
|--------|---------|-----------|
| `aims-{env}-attachments-{region}` | User-uploaded work papers | Glacier after 365 days, delete never (legal hold support) |
| `aims-{env}-reports-{region}` | Generated PDF reports | Standard → IA after 90 days, Glacier after 365 |
| `aims-{env}-exports-{region}` | User data exports (GDPR) | Delete after 7 days |
| `aims-{env}-backups-{region}` | Database logical backups | Glacier after 30 days, 7-year retention |
| `aims-{env}-cloudfront-logs` | Access logs | IA after 90 days, delete after 400 days |
| `aims-{env}-static` | CDN origin for web assets | Immutable objects (versioned filenames) |
| `aims-tf-state-{env}` | Terraform state | Versioned, 90-day version retention |

**All buckets**:
- Block Public Access: ON
- SSE-KMS (CMK per env)
- Access logging to log-archive account
- Object Lock (compliance mode) on attachments + reports + backups (7-year retention)
- CORS restricted to our domains
- Versioning enabled
- Lifecycle rules above
- Replication: cross-region on production data buckets

---

## 6. CDN — CloudFront

- Origin: ALB (for Next.js) + S3 (for static assets)
- HTTPS only; TLS 1.3; HSTS with preload
- Origin Access Control (OAC) for S3 origins
- Compression enabled
- Signed URLs for private content (presigned S3 URLs for attachments)
- Custom error pages (404, 500) from our app
- Geo restriction: deny sanctioned countries
- Real-time logs → Kinesis → Athena for analytics
- Waf association (WAFv2)

---

## 7. DNS — Route53

- Parent zone: `aims.io` in management account
- Delegated subzones per env:
  - `dev.aims.io` → dev account
  - `staging.aims.io` → staging account
  - `prod.aims.io` → prod account (and `eu.prod.aims.io` for regions)
- Customer-facing: `<tenant>.aims.io` (subdomain per tenant) — wildcard cert via ACM
- Custom domains (white-label): tenant adds CNAME `app.acme.com → acme.aims.io` + uploads cert
- DNSSEC enabled on parent zone (prevents hijack)
- Health checks with failover routing (regional DR)

### Certificates — ACM
- Wildcard cert `*.aims.io` per region in ACM
- Automatic renewal
- For custom tenant domains: tenants upload, we validate via DNS, auto-renew via Let's Encrypt if tenant keeps CNAME validation active

---

## 8. Secrets & Encryption

See `SECRETS.md` for full lifecycle. Infra highlights:

### KMS Customer Master Keys (CMKs)
| Alias | Purpose | Auto rotation |
|-------|---------|---------------|
| `aims-rds-{env}` | RDS encryption | Yearly |
| `aims-s3-{env}` | S3 SSE-KMS | Yearly |
| `aims-secrets-{env}` | Secrets Manager | Yearly |
| `aims-ebs-{env}` | EBS volume encryption | Yearly |
| `aims-tenant-{tenantId}` | Per-tenant envelope encryption (Phase 2) | Yearly |

Multi-region CMKs for replicated data (cross-region backups require).

### Secrets Manager
- DB credentials, external API keys
- Rotation Lambda for RDS (30-day automatic rotation)
- Accessed via IRSA — pods read at startup + refresh

---

## 9. IAM Patterns

### Service Accounts — IRSA
Every pod has its own IAM role via IAM Roles for Service Accounts:

```hcl
module "api_irsa" {
  source = "../modules/iam-role/irsa"
  name   = "aims-api-${env}"
  namespace = "aims"
  service_account = "aims-api"
  oidc_provider_arn = module.eks.oidc_provider_arn
  policy_arns = [
    aws_iam_policy.api_s3_attachments.arn,
    aws_iam_policy.api_secrets_read.arn,
  ]
}
```

Policies scoped to **specific resources** (specific S3 bucket prefix, specific secret ARN). No `s3:*` on `*`.

### Break-Glass Access
Emergency prod access via:
1. SSO login
2. Request `BreakGlass-Production` role with reason + duration (max 2h)
3. Slackbot posts to `#sre-approvals` for approval
4. Auto-revoked after duration
5. All actions logged to CloudTrail; immutable log archive

---

## 10. Observability Infrastructure

See `OBSERVABILITY.md` for telemetry pipeline. Infra:

- **Managed Prometheus (AMP)** per region — no self-hosting
- **Managed Grafana (AMG)** central — federated from all regions
- **CloudWatch Logs** — native AWS; otel-collector exports here
- **X-Ray** (optional) — supplement to Tempo for AWS-native traces
- **Sentry** — SaaS (hosted); consider self-hosted `sentry-onprem` for GovCloud

All cross-account — log archive account receives from every workload account for immutability.

---

## 11. Backup

### AWS Backup (centralized)
Plan:
- RDS: PITR (continuous) + daily snapshot (35-day retention) + monthly cold (7-year)
- EBS (EKS persistent volumes — rare): daily (30-day)
- S3: versioning + Object Lock (no separate "backup")
- DynamoDB (if used): PITR + daily backups

Cross-region copy on all prod backups (US ↔ EU for DR).

### Logical PG Dumps
Nightly `pg_dump` via a privileged worker pod → S3 (`aims-prod-backups`). Separate from AWS Backup — gives us logical schema + portable restore to any PG 16 instance.

---

## 12. Cost Management

### Tagging (mandatory via Terraform)
Every resource gets tags:
- `Environment`: dev/staging/production
- `Service`: web/api/worker/data/...
- `Owner`: team email
- `CostCenter`: billing code
- `TenantId`: for per-tenant attribution (via app-level tags on S3 objects; infra is shared)
- `ManagedBy`: terraform
- `Compliance`: soc2/fedramp/hipaa (bucket-level)

### AWS Budgets + Cost Anomaly
- Per-environment budget alerts (80%, 100%, 120%)
- Service-level (EKS, RDS) anomaly detection
- Slack + email notifications

### FinOps Reviews
- Monthly: right-size instances, review idle resources
- Quarterly: Reserved Instances / Savings Plans evaluation
- Annual: multi-year commit analysis

### Cost Guardrails (CI)
- Terraform plan cost diff via `infracost` — PRs show monthly impact
- Large additions (> $500/month) require extra approval

---

## 13. Compliance Controls Wired In

### SOC 2 Type II (Phase 1 — audit in Phase 5)
- CloudTrail → log archive (Trust 1.2)
- KMS CMKs + access logging (Confidentiality 1.1)
- MFA enforced via SSO (Security 6.1)
- IAM least privilege (Security 6.2)
- Change management via CI approval gates (Change Mgmt 8.1)
- Vulnerability scanning (Risk 1.4)

### FedRAMP Moderate (Phase 4)
- Requires GovCloud
- Separate dedicated tenancy
- Additional continuous monitoring, FIPS 140-2 crypto
- Full ATO process (12–18 months)

### HIPAA (tenant-elected, Phase 3)
- BAAs with AWS (signed at onboarding)
- PHI isolated buckets with stricter access
- Audit log forwarding to tenant's SIEM (optional)

### GDPR
- EU region (eu-west-1) for EU-home-region tenants
- Data export endpoints (Article 20)
- Deletion workflow (Article 17)
- DPA with customers

---

## 14. Disaster Recovery Posture

(Full detail: `DISASTER-RECOVERY.md`)

- **RPO**: 15 minutes (continuous WAL shipping via PITR)
- **RTO**: 1 hour (automated failover + runbook)
- **Strategy**: Warm standby in secondary region (read replica promoted on failover)
- **Drills**: Quarterly automated + annual live failover

---

## 15. What We Explicitly Do *Not* Do

- **No click-ops on production** — all changes via Terraform + CI
- **No shared IAM users** — SSO + roles only
- **No SSH to nodes** — SSM Session Manager if needed (rare)
- **No public S3 buckets** — zero, enforced by SCP + block-public-access
- **No `0.0.0.0/0` ingress** on anything except ALB (443)
- **No unencrypted data at rest** — KMS everywhere
- **No plaintext secrets** — Secrets Manager / Parameter Store SecureString only
- **No log-retention ≤ 30 days** on audit logs — minimum 1 year, 7 years for financial/compliance
- **No cross-tenant data leakage** — enforced at app (RLS) + infra (per-tenant encryption keys)
- **No self-hosted databases** in Phase 1 — managed RDS; re-evaluate at 10K tenants

---

## 16. SCPs (Service Control Policies)

Org-wide deny rules that cannot be overridden by member accounts:

```jsonc
// Deny leaving AWS Organization
{ "Action": "organizations:LeaveOrganization", "Effect": "Deny", "Resource": "*" }

// Deny disabling CloudTrail
{ "Action": ["cloudtrail:StopLogging", "cloudtrail:DeleteTrail"], "Effect": "Deny", "Resource": "*" }

// Deny root user (except break-glass)
{ "Principal": { "AWS": "*" }, "Action": "*", "Effect": "Deny",
  "Condition": { "StringLike": { "aws:PrincipalArn": "arn:aws:iam::*:root" } } }

// Deny regions outside approved list
{ "Effect": "Deny", "NotAction": ["iam:*","organizations:*","support:*"],
  "Resource": "*", "Condition": { "StringNotEquals": {
    "aws:RequestedRegion": ["us-east-1","us-west-2","eu-west-1","ap-southeast-1"]
  } } }
```

---

## 17. Related Documents

- [`CI-CD.md`](CI-CD.md) — pipelines that apply terraform
- [`ENVIRONMENTS.md`](ENVIRONMENTS.md) — per-env config
- [`SECRETS.md`](SECRETS.md) — KMS, Secrets Manager, rotation
- [`CONTAINERS.md`](CONTAINERS.md) — k8s workload detail
- [`DISASTER-RECOVERY.md`](DISASTER-RECOVERY.md) — DR strategy built on this infra
- [`../database/DATA-RESIDENCY.md`](../database/DATA-RESIDENCY.md) — data residency mechanics
