# Containers & Kubernetes

> Docker image strategy (distroless, multi-stage, signed), Kubernetes workload layout on EKS, Helm charts, autoscaling, network policies, GitOps via ArgoCD.

---

## 1. Why Kubernetes (vs ECS / Lambda / Render / Fly)

| Option | Chose? | Reason |
|--------|--------|--------|
| **EKS (Kubernetes)** ✅ | Yes | Portable (works in GovCloud, GCP, on-prem), mature, industry standard for regulated workloads, ArgoCD + Helm ecosystem |
| AWS ECS (Fargate) | No | Simpler, but AWS-locked; weaker community; migrating later to k8s is expensive |
| AWS Lambda (serverless) | No | Great for event handlers, not for long-running audit workflows; cold starts hurt latency SLOs |
| Render / Fly.io / Railway | No | Fine for early startups, wrong for enterprise SaaS with multi-region + compliance needs |
| Nomad | No | Smaller ecosystem; fewer compliance integrations |

We do use **Lambda** for specific event handlers (S3 triggers, EventBridge-driven tasks) — but the core app runs on EKS.

---

## 2. Docker Image Strategy

### Base Images — Distroless + Multi-Stage
All production images use **Google Distroless** base — no shell, no package manager, minimal surface:

```dockerfile
# docker/api.Dockerfile — production build (illustrative)
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/ ./packages/
RUN corepack enable && pnpm install --frozen-lockfile --filter=api...

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages ./packages
COPY apps/api ./apps/api
COPY tsconfig.base.json turbo.json ./
RUN pnpm --filter=api build

# Prune dev deps for runtime image
FROM node:22-bookworm-slim AS prune
WORKDIR /app
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/packages ./packages
COPY --from=build /app/apps/api/package.json apps/api/
RUN corepack enable && pnpm install --frozen-lockfile --prod --filter=api...

# Final — distroless, no shell
FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
COPY --from=prune /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/
USER nonroot
EXPOSE 4000
ENV NODE_ENV=production
CMD ["apps/api/dist/main.js"]
```

### Why Distroless
- No shell → exploited container can't spawn `/bin/sh`
- No package manager → no `apt-get install curl` in a compromised container
- Minimal size → faster pulls, smaller CVE surface
- Distroless `nonroot` runs as UID 65532 → no root in container

### Image Hygiene
- Non-root user required (`USER nonroot`)
- Read-only root filesystem (set in pod spec)
- Labels: `org.opencontainers.image.{source, revision, version, licenses}`
- Tag by SHA (`:main-abc1234`) — never `:latest` in any environment
- SBOM generated via Syft; attached to image via `cosign attest`
- Image signed via Cosign keyless (GitHub OIDC)

### Registry Layout (ECR)
```
<account>.dkr.ecr.<region>.amazonaws.com/
├── aims/web            ← Next.js frontend
├── aims/api            ← NestJS API
├── aims/worker         ← BullMQ worker
├── aims/migrator       ← Prisma migration job image
└── aims/dev-tools      ← Debugging / dev-only tools
```

- Lifecycle policy: delete untagged images after 7 days; keep last 50 tagged
- Image scan on push (ECR native + Trivy in CI)
- Cross-account pull: dev/staging/prod accounts can pull from `shared-services` account ECR

### Image Caching
- Docker Buildx layered cache → registry (`type=registry`)
- `pnpm` lockfile layer separate from source layer → rebuilds only on dep changes
- CI cache hit rate target > 70% on unchanged-dep PRs

---

## 3. Kubernetes Layout

### Cluster-per-Environment-per-Region
- `eks-dev-us-east-1`
- `eks-staging-us-east-1`
- `eks-prod-us-east-1`
- `eks-prod-eu-west-1`
- `eks-dr-us-west-2` (warm standby)

One cluster per combination = strong isolation. No cross-env pod-to-pod possible.

### Namespace Layout (per cluster)
```
kube-system               # AWS + core addons
aims                      # application workloads (web, api, worker)
aims-jobs                 # one-shot jobs (migrations, backfills)
aims-batch                # scheduled/heavy batch (analytics)
observability             # otel-collector, prometheus-agent (if self-hosted bits)
argocd                    # ArgoCD (prod clusters only — bootstrap via manifest elsewhere)
external-secrets          # external-secrets operator
cert-manager
ingress                   # ingress controller
velero                    # backup operator
kyverno                   # policy engine
pr-<n>                    # (dev cluster only) preview environments
```

### Resource Quotas (per namespace)
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: aims-quota
  namespace: aims
spec:
  hard:
    requests.cpu: "32"
    requests.memory: 64Gi
    limits.cpu: "64"
    limits.memory: 128Gi
    persistentvolumeclaims: "0"   # stateless apps; reject anyone trying to add PVC
    pods: "100"
```

Preview namespaces get tiny quotas (2 CPU, 4Gi) to prevent runaway costs.

---

## 4. Workloads — Deployments + HPA

### Service Catalog

| Workload | Kind | Replicas (prod) | CPU req/limit | Mem req/limit | Autoscale on |
|----------|------|-----------------|---------------|---------------|--------------|
| `web` | Deployment | 3–24 | 200m / 1000m | 512Mi / 1Gi | CPU 60% |
| `api` | Deployment | 4–40 | 500m / 2000m | 1Gi / 2Gi | CPU 65% + req/s |
| `worker` | Deployment | 2–20 | 500m / 2000m | 1Gi / 2Gi | Queue depth (KEDA) |
| `pdf-worker` | Deployment | 1–10 | 500m / 4000m | 1Gi / 4Gi | Queue depth |
| `scim-worker` | Deployment | 1–4 | 100m / 500m | 256Mi / 512Mi | CPU 60% |
| `migrator` | Job | 1 (one-shot) | 500m | 1Gi | — |
| `backup` | CronJob | 1 (nightly) | 500m | 1Gi | — |

### HPA (Horizontal Pod Autoscaler)
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: api }
  minReplicas: 4
  maxReplicas: 40
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 65 } }
    - type: Pods
      pods:
        metric: { name: http_requests_per_second }
        target: { type: AverageValue, averageValue: "100" }
  behavior:
    scaleUp:   { stabilizationWindowSeconds: 30,  policies: [{ type: Percent, value: 100, periodSeconds: 15 }] }
    scaleDown: { stabilizationWindowSeconds: 300, policies: [{ type: Percent, value: 10,  periodSeconds: 60 }] }
```

Scale up fast (flash crowds), scale down slowly (avoid flapping).

### KEDA for Queue-Depth Scaling
Workers scale on BullMQ queue depth via KEDA ScaledObject:
```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: worker, namespace: aims }
spec:
  scaleTargetRef: { name: worker }
  minReplicaCount: 2
  maxReplicaCount: 20
  triggers:
    - type: redis
      metadata:
        address: REDIS_URL_FROM_ENV
        listName: bull:default:wait
        listLength: "50"
```

### Pod Disruption Budget (PDB)
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata: { name: api-pdb }
spec:
  minAvailable: 75%
  selector: { matchLabels: { app: api } }
```

Prevents voluntary disruption (cluster upgrades, node drains) from taking down too many pods at once.

---

## 5. Pod Spec — Required Fields

Every production pod includes:

```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 65532
    fsGroup: 65532
    seccompProfile: { type: RuntimeDefault }
  containers:
    - name: api
      image: ecr.aws/aims/api:v1.2.3@sha256:abc...    # pinned by digest
      imagePullPolicy: IfNotPresent
      ports:
        - { name: http, containerPort: 4000 }
      resources:
        requests: { cpu: 500m, memory: 1Gi }
        limits:   { cpu: 2000m, memory: 2Gi }
      securityContext:
        allowPrivilegeEscalation: false
        readOnlyRootFilesystem: true
        capabilities: { drop: ["ALL"] }
      envFrom:
        - configMapRef: { name: api-config }
        - secretRef:    { name: api-secrets }   # via external-secrets
      env:
        - name: POD_NAME
          valueFrom: { fieldRef: { fieldPath: metadata.name } }
        - name: OTEL_RESOURCE_ATTRIBUTES
          value: "service.name=aims-api,service.version=$(APP_VERSION)"
      livenessProbe:
        httpGet: { path: /livez, port: http }
        initialDelaySeconds: 30
        periodSeconds: 10
      readinessProbe:
        httpGet: { path: /readyz, port: http }
        initialDelaySeconds: 5
        periodSeconds: 5
      startupProbe:
        httpGet: { path: /livez, port: http }
        failureThreshold: 30
        periodSeconds: 5
      volumeMounts:
        - { name: tmp, mountPath: /tmp }
        - { name: cache, mountPath: /app/.cache }
  volumes:
    - { name: tmp, emptyDir: {} }
    - { name: cache, emptyDir: {} }
  topologySpreadConstraints:
    - maxSkew: 1
      topologyKey: topology.kubernetes.io/zone
      whenUnsatisfiable: ScheduleAnyway
      labelSelector: { matchLabels: { app: api } }
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            topologyKey: kubernetes.io/hostname
            labelSelector: { matchLabels: { app: api } }
```

### Health Endpoints (contract)
- `/livez` — process is alive (never false unless deadlocked). Used for restart.
- `/readyz` — accepting traffic (DB connected, dependencies OK). Used to gate traffic.
- `/startupz` — initial startup done. Prevents liveness from killing during slow start.
- `/metrics` — Prometheus scrape endpoint (port 4001, separate from API port)

### Graceful Shutdown
- On SIGTERM: stop accepting new connections, drain in-flight requests (30s), exit
- `terminationGracePeriodSeconds: 60` on pod
- HPA/rollout won't kill next pod until current finishes draining (PDB enforces)

---

## 6. Networking & Service Mesh

### Services
ClusterIP services front each deployment. Name follows `<workload>` (e.g., `api`, `web`, `worker`).

### Ingress
AWS Load Balancer Controller creates ALB via Ingress resources:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: aims-ingress
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:...
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    alb.ingress.kubernetes.io/wafv2-acl-arn: arn:aws:wafv2:...
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/healthcheck-path: /readyz
spec:
  rules:
    - host: "*.aims.io"
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend: { service: { name: api, port: { number: 80 } } }
          - path: /
            pathType: Prefix
            backend: { service: { name: web, port: { number: 80 } } }
```

### NetworkPolicy (default deny)
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: default-deny, namespace: aims }
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
# then explicit allows per service:
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: allow-api-ingress, namespace: aims }
spec:
  podSelector: { matchLabels: { app: api } }
  ingress:
    - from:
        - namespaceSelector: { matchLabels: { name: ingress } }
      ports: [{ port: 4000 }]
  egress:
    - to: [{ namespaceSelector: { matchLabels: { name: aims } }, podSelector: { matchLabels: { app: worker } } }]
    - to: [{ ipBlock: { cidr: 10.20.20.0/24 } }]    # DB subnet
      ports: [{ port: 5432 }]
    - to: [{ ipBlock: { cidr: 10.20.20.0/24 } }]    # Redis
      ports: [{ port: 6379 }]
    - ports: [{ port: 53, protocol: UDP }]          # DNS
```

### Service Mesh (Phase 2)
Istio or Linkerd for:
- Automatic mTLS between pods
- Fine-grained traffic policies
- Canary traffic splitting at service level
- Detailed observability

Not Phase 1 — baseline k8s + Calico gets us 80% of value.

---

## 7. Helm Charts

One umbrella chart per environment, composing per-service subcharts.

```
infrastructure/helm/aims-v2/
├── Chart.yaml               # version: x.y.z
├── values.yaml              # defaults
├── values-dev.yaml
├── values-staging.yaml
├── values-production.yaml
├── charts/
│   ├── web/
│   │   ├── templates/{deployment,service,hpa,pdb,servicemonitor}.yaml
│   │   └── values.yaml
│   ├── api/
│   ├── worker/
│   ├── pdf-worker/
│   └── shared/              # common templates (helpers, labels)
└── tests/                   # helm lint + kubeval
```

### Template Discipline
- `_helpers.tpl` for standard labels, annotations, selectors
- No magic in templates — data transformations live in values
- Lint in CI (`helm lint`, `kubeval`, `kubeconform`, `polaris`)
- Rendered diff in PR (via `argocd diff` or `helm-diff`)

### Chart Versioning
Chart version bumped on every structural change. App version tracks release version. CI fails on template changes without version bump.

---

## 8. GitOps — ArgoCD

### Model
- `main` branch holds Helm charts + environment overlays
- ArgoCD installed in a dedicated cluster (or dev/staging clusters' argocd namespace for their own mgmt)
- ArgoCD Application per (env × service) watches `main` for changes
- `autoSync: true` for dev/staging; **manual sync with approval** for production

### Prod Sync Flow
1. CI pushes new image tag (via PR updating `values-production.yaml` with new tag)
2. PR reviewed + merged by release manager
3. ArgoCD detects drift — shows diff
4. Release manager clicks "Sync" in ArgoCD UI → rollout triggered
5. Argo Rollouts orchestrates canary progression

### ApplicationSet for Multi-Env
```yaml
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata: { name: aims-v2-apps }
spec:
  generators:
    - list:
        elements:
          - cluster: prod-us,      url: https://prod-us.example,  valuesFile: values-production.yaml
          - cluster: prod-eu,      url: https://prod-eu.example,  valuesFile: values-production.yaml
  template:
    metadata: { name: '{{cluster}}-aims-v2' }
    spec:
      project: aims-v2
      source:
        repoURL: github.com/acme/aims-v2
        targetRevision: main
        path: infrastructure/helm/aims-v2
        helm: { valueFiles: ['{{valuesFile}}'] }
      destination: { server: '{{url}}', namespace: aims }
      syncPolicy:
        automated: { selfHeal: true, prune: true }
```

### Self-Heal vs Prune
- **Self-heal ON** for staging/dev — if someone `kubectl edit`, ArgoCD reverts
- **Self-heal OFF** for production — manual reconciliation only (change control)
- **Prune ON** in all envs — removed manifests actually deleted

---

## 9. Progressive Delivery — Argo Rollouts

For `web` and `api` (user-facing services), replace `Deployment` with `Rollout`:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata: { name: api }
spec:
  replicas: 10
  selector: { matchLabels: { app: api } }
  template: # same as Deployment template
  strategy:
    canary:
      canaryService: api-canary
      stableService: api-stable
      trafficRouting:
        alb:
          ingress: aims-ingress
          servicePort: 80
      steps:
        - setWeight: 1
        - pause: { duration: 5m }
        - analysis:
            templates: [{ templateName: slo-check }]
        - setWeight: 5
        - pause: { duration: 5m }
        - analysis:
            templates: [{ templateName: slo-check }]
        - setWeight: 25
        - pause: { duration: 10m }
        - analysis:
            templates: [{ templateName: slo-check }]
        - setWeight: 100
```

### Analysis Templates (SLO-gated promotion)
```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata: { name: slo-check }
spec:
  metrics:
    - name: error-rate
      interval: 1m
      successCondition: result[0] < 0.01
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.observability:9090
          query: |
            sum(rate(http_requests_total{app="api-canary",status=~"5.."}[1m]))
            / sum(rate(http_requests_total{app="api-canary"}[1m]))
    - name: p99-latency
      interval: 1m
      successCondition: result[0] < 800
      failureLimit: 1
      provider:
        prometheus:
          query: |
            histogram_quantile(0.99, sum by (le) (rate(http_request_duration_ms_bucket{app="api-canary"}[1m])))
```

Any SLO breach → auto-rollback.

---

## 10. Workload-Specific Patterns

### Next.js (`web`)
- Standalone output (`output: "standalone"` in `next.config.js`) → smaller runtime image
- Image optimization uses CloudFront upstream (Next server doesn't touch `/public/images`)
- HTTPS terminated at ALB; Next runs HTTP internally
- Client-side env vars baked at build time; server env vars via k8s env

### NestJS (`api`)
- Prisma Client bundled with `engineType = "binary"` (avoid Rust runtime surprises)
- Graceful shutdown: `app.enableShutdownHooks()`
- Worker pool tuned: Node cluster disabled (let k8s HPA do scaling), `libuv` thread pool = `UV_THREADPOOL_SIZE=16` (for bcrypt/argon2)

### Worker (`worker` / `pdf-worker`)
- Separate deployments per queue type (isolation, independent scaling)
- KEDA autoscale on queue depth
- Longer `terminationGracePeriodSeconds: 300` (finish long-running jobs)
- PDF worker needs more memory + tmp space (Puppeteer spawns Chromium)

### Migrator (one-shot Job)
- Runs before rolling out new `api` image
- Image pinned to target version
- Uses Prisma with separate `aims_migration` DB role (DDL perms) — app role has no DDL
- Timeout: 10 min (safe-migration). Ambiguous migrations gated in CI.

---

## 11. Persistence

We are **mostly stateless in k8s**. State lives in RDS, ElastiCache, S3.

### Exceptions (rare stateful workloads)
- **CI runners** (self-hosted for GitHub Actions — Phase 2) — use gp3 PVCs
- **Prometheus local WAL** — Phase 1 uses AMP (managed); self-hosted would need StatefulSet

If stateful workload introduced:
- StatefulSet with PVC template
- EBS gp3, encrypted with KMS
- Backup via Velero + EBS snapshots via AWS Backup
- Must have DR story

---

## 12. Policy Enforcement — Kyverno

Kyverno policies reject non-compliant resources at admission:

- Deny containers running as root
- Require `securityContext.readOnlyRootFilesystem: true`
- Require resource requests + limits
- Block image pulls from untrusted registries
- Require signed images (Cosign verification)
- Require `topologySpreadConstraints`
- Require specific labels (`app`, `tier`, `managed-by`)
- Disallow `hostNetwork`, `hostPath`, `privileged: true`
- Disallow `latest` image tag

Policies in `infrastructure/kubernetes/policies/`, Terraform-deployed.

---

## 13. Secrets In Cluster

See `SECRETS.md` for full secret lifecycle. In-cluster path:

1. AWS Secrets Manager / Parameter Store holds the source of truth
2. `external-secrets` operator watches SecretStore references
3. ESO materializes k8s `Secret` objects (from AWS) in the right namespaces
4. Pods mount via `secretRef` → env vars (or files if needed)
5. ESO refreshes every 30 min; pod restart on secret change (optional — via Reloader)

**No raw k8s secrets committed** — only `ExternalSecret` manifests that reference AWS resources.

---

## 14. Deployment Strategy per Env

| Env | Strategy |
|-----|----------|
| local | n/a — docker-compose |
| preview | Recreate (small pods, no traffic implications) |
| dev | RollingUpdate (maxSurge 25%, maxUnavailable 25%) |
| staging | RollingUpdate + Argo Rollouts (canary disabled, as soak gate) |
| production | Argo Rollouts canary with SLO analysis |

### Rollback Mechanics
- `argocd app rollback aims-v2-prod-us <revision>` — reverts to prior git SHA of values
- `kubectl argo rollouts undo` — reverts rollout without touching git
- In extreme cases: scale to zero + serve static maintenance page from CloudFront

Target rollback time (from decision to customer-served): **< 5 minutes**.

---

## 15. Multi-Region Considerations

- Each region is an independent cluster with its own ArgoCD app pointing at same git `values-production.yaml` + region-specific overlay
- Region-specific values: regional DB endpoint, regional Redis, region code tagged
- Global routing (via Route53 weighted / latency) shifts traffic between regions for failover or multi-active
- Session cookies region-sticky (custom cookie attribute tenant-region) — prevents split-brain

---

## 16. Debugging in Kubernetes

### kubectl Aliases (team standard)
```bash
alias k='kubectl'
alias kgp='kubectl get pods'
alias kl='kubectl logs -f'
alias kd='kubectl describe'
alias kex='kubectl exec -it'
```

### Ephemeral Debug Containers (k8s ≥ 1.25)
```bash
kubectl debug -it pod/api-abc123 --image=busybox --target=api
```

Injects debug container sharing process namespace — no need for shell in distroless app image.

### Logs
Use `stern` for multi-pod tailing: `stern -n aims api`

### Interactive Session
JIT prod access required. Session Manager to bastion namespace if ever needed (rare — most debugging via logs + traces).

---

## 17. Scheduled Jobs (CronJobs)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata: { name: nightly-backup, namespace: aims-batch }
spec:
  schedule: "0 3 * * *"
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 7
  jobTemplate:
    spec:
      backoffLimit: 2
      activeDeadlineSeconds: 14400
      template:
        spec:
          restartPolicy: Never
          serviceAccountName: backup
          containers:
            - name: backup
              image: ecr.aws/aims/worker:v1.2.3
              command: ["node", "dist/scripts/backup.js"]
```

Common jobs:
- `nightly-backup` — logical PG dump → S3
- `daily-metrics-rollup` — aggregate metrics for dashboards
- `weekly-cleanup` — prune expired drafts, cleanup orphaned S3 uploads
- `hourly-health-probe` — external synthetic (if not using Checkly)

---

## 18. What We Don't Do In Kubernetes

- **No Tiller** (that's Helm v2; we're on v3)
- **No Operators we don't own/understand** — every operator is a supply-chain risk
- **No HostNetwork pods**
- **No privileged containers**
- **No stateful DBs in k8s** — managed RDS/ElastiCache
- **No self-hosted prometheus for prod** — AMP (managed) is cheaper + easier; self-host only for special cases
- **No cluster-level `cluster-admin` RBAC** except break-glass — use scoped Roles/RoleBindings

---

## 19. Related Documents

- [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) — EKS cluster provisioning
- [`CI-CD.md`](CI-CD.md) — pipelines that push images and trigger deploys
- [`OBSERVABILITY.md`](OBSERVABILITY.md) — what pods emit
- [`SECRETS.md`](SECRETS.md) — how secrets reach pods
- [`RELEASE.md`](RELEASE.md) — Argo Rollouts canary strategy
