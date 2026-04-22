# AIMS v2 — Local Development Infrastructure

Docker Compose stack for Slice A development. Not a production config.

## What runs

| Service | Port(s) | Purpose |
|---|---|---|
| `postgres` | 5433 (→ container 5432) | Primary datastore. 16-alpine. 4 roles provisioned per `database/policies/roles.sql`. Remapped to 5433 because 5432 was taken on the dev machine. |
| `localstack` | 4566 | AWS mocks: KMS (ALE master key), SQS (outbox + PDF render queues), S3 (evidence/reports/audit-logs buckets). |
| `redis` | 6379 | Session blocklist cache per ADR-0005. |
| `mailpit` | 1025 (SMTP), 8025 (UI) | Local SMTP capture. View all outgoing dev mail at http://localhost:8025. |

## Prerequisites

- Docker Desktop (or OrbStack, colima, etc.) — any engine with `docker compose`
- Ports 5432 / 4566 / 6379 / 1025 / 8025 free on host

## Quick start

From the repo root:

```bash
# Bring everything up
pnpm infra:up

# Tail logs (Ctrl+C to detach; services keep running)
pnpm infra:logs

# Check status
pnpm infra:ps

# Stop (keeps volumes — next `up` resumes with data intact)
pnpm infra:down

# Stop + nuke volumes (fresh DB, fresh LocalStack state)
pnpm infra:reset
```

## Verify everything is healthy

```bash
# Postgres
docker exec aims-postgres pg_isready -U aims_superadmin -d aims_dev
# → /var/run/postgresql:5432 - accepting connections

# LocalStack (check the bootstrap ran and resources exist)
curl -s http://localhost:4566/_localstack/health | grep -o '"kms":"[^"]*"'
# → "kms":"running"

aws --endpoint-url=http://localhost:4566 \
    --region=us-east-1 \
    kms list-aliases --output text
# → ...alias/aims-dev-master...

aws --endpoint-url=http://localhost:4566 \
    --region=us-east-1 \
    sqs list-queues --output text
# → 4 URLs ending in aims-events-outbox, aims-events-outbox-dlq, aims-pdf-render, aims-pdf-render-dlq

aws --endpoint-url=http://localhost:4566 \
    --region=us-east-1 \
    s3 ls
# → 3 buckets: aims-dev-evidence, aims-dev-reports, aims-dev-audit-logs

# Redis
redis-cli -h localhost ping
# → PONG

# Mailpit UI
open http://localhost:8025   # macOS
```

If you don't have the AWS CLI installed, use `aws` via a container: `docker run --rm --network host amazon/aws-cli --endpoint-url=http://localhost:4566 ...`.

## Connecting from the app

Copy `.env.example` at repo root to `.env.local` and adjust as needed. The defaults are wired to this compose stack.

```bash
cp .env.example .env.local
```

## What's NOT here (deferred)

- ❌ Real AWS (EKS, RDS, KMS, SQS, S3) — later slice
- ❌ OpenTelemetry collector + Grafana/Tempo/Loki — later task (Week 4 OTel wiring uses console exporter)
- ❌ NGINX / reverse proxy — not needed for Slice A
- ❌ Minio (alternative S3) — LocalStack S3 is fine
- ❌ PgBouncer — direct connections work for dev; pool multiplexing semantics tested only in integration tests

## Troubleshooting

### Postgres won't start / role creation fails

```bash
pnpm infra:reset    # wipes volumes and restarts
pnpm infra:logs     # watch init.sql run
```

### LocalStack buckets / queues / keys missing after restart

`PERSISTENCE=1` is set, so state persists across restarts. If something is off:

```bash
pnpm infra:reset
```

Init script (`localstack/init/01-bootstrap.sh`) runs whenever LocalStack starts with an empty volume.

### Port conflicts

If one of 5432 / 4566 / 6379 / 1025 / 8025 is taken on your host:
1. Find the culprit: `lsof -i :5432` etc.
2. Stop it, OR edit `docker-compose.yml` to map to a different host port.

### "Out of memory" running LocalStack

LocalStack Community is hungry (~1-2 GB idle). Raise Docker Desktop's memory limit to 6 GB+.

## File layout

```
infra/
├── README.md                          # this file
├── docker-compose.yml                 # main compose stack
├── postgres/
│   └── init.sql                       # extensions + roles bootstrap
└── localstack/
    └── init/
        └── 01-bootstrap.sh            # KMS + SQS + S3 provisioning (runs via ready.d hook)
```
