# Slice A — Playwright end-to-end

Drives the full vertical slice through the live web UI and asserts the
journey lands as expected, including MFA step-up flows, report signing,
the worker's PDF render, and the presigned download.

## Prerequisites

The stack must be up. From the repo root:

```bash
pnpm infra:up                              # Postgres + LocalStack + Redis
pnpm --filter @aims/prisma-client db:migrate:deploy

# Three dev processes (separate terminals or a process manager):
pnpm --filter @aims/api dev                # http://localhost:3001
pnpm --filter @aims/web dev                # http://localhost:3000
pnpm --filter @aims/worker dev             # SQS poller + outbox publisher
```

`global-setup.ts` wipes business tables and seeds a fresh tenant + user +
GAGAS pack + pre-attached engagement before each run, so you can re-run
the test in a loop without resetting state by hand. **It does not touch
the schema; migrations must already be applied.**

## Running

From `apps/web`:

```bash
pnpm test:e2e          # headless, single worker
pnpm test:e2e:ui       # Playwright's UI mode for stepping through
```

From the repo root:

```bash
pnpm --filter @aims/web test:e2e
```

## What the test covers

`slice-a.spec.ts` walks one happy path:

1. Sign in (password)
2. Open the seeded engagement
3. Create a finding, fill the four GAGAS elements, save now, submit for review
4. Switch to the Approvals queue, open the finding, approve — modal opens
   on first click (PRECONDITION_FAILED step-up), TOTP code generated from
   the fixture's known secret unblocks; auto-replay marks it APPROVED
5. Generate a report, fill three editorial sections, save, submit for
   signoff
6. Click **Sign & publish**, type "I approve", supply a fresh TOTP code,
   confirm — status flips to PUBLISHED
7. Wait for the worker to drain the outbox and write the PDF; the
   composer's status alert flips to "PDF rendered"
8. Click **Download PDF** — captures the popup and asserts the URL
   targets the reports bucket and carries an AWS signature

## Credentials

`fixtures/credentials.ts` exports the deterministic test identity:

| Field          | Value                          |
|----------------|--------------------------------|
| Tenant slug    | `northstar-e2e`                |
| Email          | `jenna-e2e@northstar.test`     |
| Password       | `e2e-Test-Password-123!`       |
| TOTP secret    | `JBSWY3DPEHPK3PXP` (base32)    |

Hardcoded so a failed run can be reproduced manually — paste the password
into the running web UI at `http://localhost:3000/sign-in`, generate a
code via any TOTP app or `node -e "console.log(require('otplib').authenticator.generate('JBSWY3DPEHPK3PXP'))"`,
and click through.
