# AIMS v2 — Technology Stack

## Decision Criteria

For an enterprise audit/GRC platform, we prioritize:
1. **Type safety** end-to-end (audit data integrity is critical)
2. **Mature ecosystem** (enterprise clients need stability, not bleeding-edge experiments)
3. **Developer productivity** (small team building a large platform)
4. **Security-first** (handling sensitive audit evidence, PII, financial data)
5. **Scalability** (multi-tenant SaaS with potentially thousands of orgs)
6. **Flexibility** (deploy cloud, on-prem, or hybrid — government clients often require on-prem)

---

## Recommended Stack

### Frontend

| Choice | Technology | Why |
|--------|-----------|-----|
| **Framework** | **Next.js 15** (App Router + React 19) | Industry standard for enterprise React. SSR/ISR for performance, built-in API routes, excellent DX. React 19 brings Server Components and Actions for cleaner data flow |
| **UI Library** | **Shadcn/ui** (built on Radix primitives) | Copy-paste components you own (no vendor lock-in). Accessible by default. Beautiful out of the box. Tailwind-native. Massive community |
| **Styling** | **Tailwind CSS v4** | Utility-first, design-system friendly, excellent for maintaining consistent enterprise UI. v4 has native cascade layers and custom selectors |
| **Forms** | **React Hook Form + Zod** | You already know this from AIMS v1. Best performance for complex multi-field audit forms. Zod schemas shared with API validation |
| **Rich Text** | **TipTap v2** | Already proven in AIMS v1. Collaborative editing support for v2 |
| **Charts** | **Recharts** or **Tremor** | Recharts carries over from v1. Tremor is a newer alternative built on Shadcn aesthetics |
| **Tables** | **TanStack Table v8** | Headless, supports sorting, filtering, pagination, column visibility — critical for audit data grids |
| **Date Handling** | **date-fns v3** | Already using in v1, lightweight, tree-shakeable |

### Backend

| Choice | Technology | Why |
|--------|-----------|-----|
| **Framework** | **NestJS** | Enterprise-grade Node.js framework. Built-in support for modules, guards (RBAC), interceptors (audit logging), middleware (multi-tenancy). Decorator-based, highly organized |
| **API Layer** | **tRPC** (primary) + **REST** (public API) | tRPC for type-safe frontend-backend communication (zero API contract drift). REST endpoints for third-party integrations and public API |
| **Validation** | **Zod** | Shared schemas between frontend forms and backend validation. Single source of truth |
| **File Handling** | **Multer + S3 SDK** | Handles workpaper uploads. S3-compatible (AWS S3, Azure Blob, MinIO for on-prem) |
| **PDF Generation** | **pdfmake** | Proven in AIMS v1 for 12 report types. Works server-side in Node.js |
| **Email** | **Resend** or **Nodemailer** | Transactional emails for approvals, notifications, password resets |
| **Job Queue** | **BullMQ + Redis** | Background jobs: PDF generation, email sending, data migration, scheduled reports |
| **Real-time** | **Socket.io** or **Server-Sent Events** | Live collaboration, approval notifications, audit trail streaming |

### Database

| Choice | Technology | Why |
|--------|-----------|-----|
| **Database** | **PostgreSQL 16+** | Gold standard for enterprise. JSONB for flexible standard configs, Row-Level Security (RLS) for multi-tenancy, full-text search, excellent ACID compliance |
| **ORM** | **Prisma 5** | Mature migrations, type-safe queries, excellent DX, introspection. Schema-first approach works perfectly for audit data models |
| **Cache** | **Redis** | Session storage, job queues, real-time pub/sub, API response caching |
| **Search** | **PostgreSQL Full-Text Search** (start) → **Meilisearch** (scale) | PG FTS is good enough initially. Meilisearch when you need instant search across millions of findings/workpapers |

### Authentication & Authorization

| Choice | Technology | Why |
|--------|-----------|-----|
| **Auth** | **Better Auth** or **Auth.js v5** | Open-source, flexible. Supports email/password, magic links, OAuth, and most importantly — enterprise SSO (SAML, OIDC) |
| **SSO** | **SAML 2.0 + OIDC** | Enterprise clients require SSO via Azure AD, Okta, OneLogin, etc. |
| **RBAC** | **Custom with CASL** | CASL (Isomorphic Authorization) for fine-grained permissions. Define abilities per role per standard |
| **MFA** | **TOTP + WebAuthn** | Required for audit platforms handling sensitive data |

### Infrastructure & DevOps

| Choice | Technology | Why |
|--------|-----------|-----|
| **Monorepo** | **Turborepo + pnpm** | Fast builds, shared packages (types, validation schemas, utils). pnpm for efficient disk usage |
| **Containerization** | **Docker + Docker Compose** | Consistent dev/staging/prod environments. Required for on-prem deployment option |
| **CI/CD** | **GitHub Actions** | You're already on GitHub. Matrix builds, auto-deploy, release management |
| **Hosting (SaaS)** | **Vercel** (frontend) + **Railway** or **Render** (backend) → **AWS/Azure** (enterprise) | Start simple, scale to managed Kubernetes when needed |
| **Hosting (On-Prem)** | **Docker Compose** or **K8s Helm Charts** | Government clients often can't use SaaS. Ship a self-hosted option |
| **File Storage** | **AWS S3** (cloud) / **MinIO** (on-prem) | S3-compatible API works everywhere |
| **Monitoring** | **Sentry** (errors) + **Prometheus + Grafana** (metrics) | Error tracking, performance monitoring, uptime alerts |

### Testing

| Choice | Technology | Why |
|--------|-----------|-----|
| **Unit/Component** | **Vitest** | 10x faster than Jest. Compatible with Jest API. Built-in TypeScript support |
| **E2E** | **Playwright** | Cross-browser testing, excellent for complex form workflows, API testing built-in |
| **API Testing** | **Supertest** (integration) + **Playwright API** | Test tRPC and REST endpoints |
| **Load Testing** | **k6** | Verify multi-tenant performance under load |

---

## Monorepo Structure

```
aims-v2/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   ├── api/                    # NestJS backend
│   └── docs/                   # Documentation site (optional)
├── packages/
│   ├── shared-types/           # TypeScript interfaces (shared)
│   ├── validation/             # Zod schemas (shared frontend + backend)
│   ├── standard-packs/         # Standard definitions (GAGAS, IIA, SOX...)
│   │   ├── gagas/
│   │   ├── iia-ippf/
│   │   └── sox-pcaob/
│   ├── pdf-engine/             # PDF generation (shared)
│   ├── ui/                     # Shared Shadcn components (optional)
│   └── utils/                  # Date, format, permission helpers
├── prisma/
│   ├── schema.prisma           # Database schema
│   └── migrations/             # Migration history
├── docker/
│   ├── Dockerfile.web
│   ├── Dockerfile.api
│   └── docker-compose.yml
├── .github/
│   └── workflows/              # CI/CD pipelines
├── turbo.json                  # Turborepo config
├── package.json                # Root workspace
└── pnpm-workspace.yaml
```

---

## Why This Stack Over Alternatives

### Why Next.js over Angular?
- React ecosystem is 3-4x larger (more libraries, more talent)
- Next.js App Router with Server Components reduces client-side bundle
- You already have deep React experience from AIMS v1
- Angular is excellent but heavier for a small team

### Why NestJS over plain Express/Fastify?
- Built-in module system, dependency injection, guards, interceptors
- Opinionated structure prevents spaghetti code in a large codebase
- First-class TypeScript support
- Enterprise patterns (CQRS, microservices) available when needed

### Why Prisma over Drizzle?
- More mature migration system (critical for enterprise with long-lived databases)
- Better tooling (Prisma Studio, introspection)
- Drizzle is faster at runtime but Prisma's DX wins for complex schemas

### Why PostgreSQL over SQL Server?
- Open source = no licensing costs (important for SaaS margins and on-prem)
- Superior JSONB support for flexible standard configurations
- Row-Level Security for multi-tenancy at the database level
- Runs anywhere (cloud, on-prem, containers)

### Why Shadcn/ui over Fluent UI?
- Fluent UI is Microsoft-centric; Shadcn is framework-agnostic
- You own the components (copy-paste, not dependency)
- Built on Radix — accessible by default, keyboard-navigable
- Tailwind-native = consistent with rest of styling approach
- Beautiful default theme + easy customization

---

## Key Architecture Decisions

### Multi-Tenancy Strategy
**Database-per-tenant** for enterprise / on-prem clients.
**Shared database with RLS** for SaaS tier (cost-effective, easier to manage).
Prisma schema supports both via tenant_id column + RLS policies.

### Standards as Packages
Each audit standard is a self-contained package in `packages/standard-packs/`.
Contains: terminology, templates, checklists, validation rules, report formats, crosswalk mappings.
The core engine loads the appropriate pack based on engagement configuration.

### API-First Design
Every feature is an API endpoint first, UI second.
Enables: mobile apps, third-party integrations, CLI tools, automated testing.
tRPC for internal (type-safe), REST for external (standard, documented).

### Offline Support (Future)
Service workers + IndexedDB for auditors working in the field without internet.
Sync engine reconciles changes when back online.
Important for government auditors visiting remote sites.
