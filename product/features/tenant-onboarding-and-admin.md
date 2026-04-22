# Tenant Onboarding and Account Management

> Everything that happens before an auditor ever authors a finding. Self-serve signup, enterprise sales-assisted onboarding, tenant settings, subscription management, billing, regional binding, offboarding, trust center. Module 1 in the feature inventory; Sofia (Tenant Admin) and internal Customer Success personnel are primary operators.

**Module reference**: [03-feature-inventory.md](../03-feature-inventory.md) Module 1
**Primary personas**: Sofia (Tenant Admin), Customer Success (internal), Elena (CPA Partner signing contracts), Ravi (Platform Admin for lifecycle operations)
**MVP phase**: 1.0 (most); regional migration + on-prem → v2.2+

---

## 1. Feature overview

Tenant onboarding and administration covers the pre-audit infrastructure: how customers sign up, configure their tenant, pay for their subscription, and manage tenant-wide settings. Post-MVP 1.0, additional capabilities (full SCIM, regional migration, on-premises deployment) layer on.

For the Segment A + B launch strategy per [`04-mvp-scope.md §2`](../04-mvp-scope.md):
- **Segment B (self-serve Starter)**: fully self-serve signup → provisioning → paid subscription without sales touch
- **Segment A (sales-assisted Professional/Enterprise)**: sales-led with onboarding engagement (1-4 weeks implementation)
- **Segment C (Government, MVP 1.5+)**: extensive services engagement (3-6 months implementation)

### 1.1 Why this matters for commercial viability

Without clean onboarding, Segment B self-serve won't scale and Segment A pilots take longer than needed. Per [`04-mvp-scope.md §2.1`](../04-mvp-scope.md) acceptance criteria 5.4, MVP 1.0 needs onboarding working well enough to sign 5 paid Professional + 10 self-serve Starter customers before GA.

---

## 2. User stories — Self-serve signup (Segment B)

### 2.1 US-TO-001 — Solo practitioner signs up for Starter

```gherkin
GIVEN a solo CPA (Jane) running a small audit practice
  AND she finds aims.io via Google search
WHEN Jane visits aims.io/signup
  AND enters:
    - Business name
    - Email
    - Region (US / EU / APAC selection)
    - Primary use case (Single Audits / SOC 2 attestation / Performance audits / Multi)
  AND creates password
  AND accepts ToS + privacy policy
  AND verifies email (magic link)
THEN tenant provisioned within 60 seconds
  AND Jane receives welcome email with:
    - Login link
    - Getting-started guide
    - 14-day free trial notification
    - Help center link
  AND first login lands on Guided Setup wizard
```

**Acceptance criteria**:
- Self-serve provisioning fully automated
- Regional binding chosen at signup (per [`docs/06 §4.8`](../../docs/06-design-decisions.md) silo architecture)
- Email verification required before login
- Tenant created with Starter tier defaults
- 14-day free trial standard

### 2.2 US-TO-002 — Guided setup wizard on first login

```gherkin
GIVEN Jane's tenant is provisioned
WHEN she logs in for the first time
THEN Setup Wizard walks her through:
  - Organization profile (logo, timezone, fiscal year)
  - First user (herself as Audit Function Director)
  - First engagement (optional; can do later)
  - Methodology pack selection (GAGAS only vs. GAGAS + Single Audit, etc.)
  - Billing setup
  - Optional SSO (v2.1 for Starter; most Starter customers skip)
  AND each step is skippable (except billing before day 14)
```

**Acceptance criteria**:
- Wizard friendly; skip-able
- Progressive disclosure (don't overwhelm with SSO etc. for solo practitioner)
- Defaults sensible

### 2.3 US-TO-003 — Starter billing setup

```gherkin
GIVEN day 14 of trial approaches
  AND Jane hasn't added payment method
WHEN reminder email fires
THEN Jane clicks billing link
  AND enters credit card via Stripe-hosted form (PCI compliance)
  AND selects monthly/annual
  AND confirms subscription
THEN subscription activated
  AND invoice generated
  AND billing portal accessible from settings
```

**Acceptance criteria**:
- Stripe or equivalent payment processor
- Self-serve pricing transparent
- Monthly: $29-49/user/mo; Annual: ~2 months free
- Invoice and receipt emails automatic

---

## 3. User stories — Enterprise sales-assisted onboarding (Segment A)

### 3.1 US-TO-004 — Sales executes contract

```gherkin
GIVEN Sales team closes deal with Morales Vasquez CPA (40 users, Professional tier)
WHEN Customer Success lead kicks off onboarding
THEN internal project setup:
  - Tenant provisioned by Ravi with Professional tier
  - Customer Success assigned as primary contact
  - Implementation calendar set (2-4 weeks typical)
  - Custom terms / contract recorded
  - Initial user credentials sent to customer champion
```

**Acceptance criteria**:
- Enterprise tenants provisioned with custom attributes (contract number, payment terms, multi-year commit)
- Customer Success team has direct-to-tenant admin access for onboarding (time-bounded, logged)
- Initial user list imported from CSV

### 3.2 US-TO-005 — Customer Success leads configuration

Onboarding tasks over 2-4 weeks:
- SSO setup (Okta / Azure AD / Google Workspace integration)
- Initial user provisioning (via SCIM or CSV)
- Pack selection and annotation if bureau-specific
- Template library customization
- Training sessions (live + recorded)
- First engagement kickoff

### 3.3 US-TO-006 — Data migration from competitor (scoped to prevent in-flight-engagement import)

```gherkin
GIVEN Morales Vasquez is migrating from TeamMate+
  AND they have 200 historical engagements + active 20 in-flight
WHEN Customer Success + customer engage in migration
THEN AIMS supports migration for three categories only:
  1. **Audit Universe entities** — process/program catalogue with risk ratings
  2. **Staff directory + CPE history** — auditors + their completed CPE records
  3. **Archived/read-only engagements** — historical engagements as reference only (not workable)
  AND explicitly does NOT support:
  - **In-flight engagement import** — engagements currently in PLANNING/FIELDWORK/REPORTING phase at the competitor
  - The customer's choice: (a) finish in-flight engagements in the legacy tool, then migrate the rest; or (b) start those engagements over in AIMS
  AND Customer Success advises on which approach suits the customer's timeline
  AND professional services package available for data cleanup
```

**Why the in-flight-engagement restriction**: competitor phase gates, approval chains, workflow states, and finding shapes don't map cleanly to AIMS's resolver-combined state machines. Attempting to import an engagement mid-FIELDWORK from TeamMate+ produces data that either doesn't fit AIMS's workflow (violates the state machine) or loses fidelity (forcing the import to pick the nearest equivalent, which may be wrong). Either outcome compromises audit evidence integrity. The honest scope: historical engagements are readable reference only; new engagements use AIMS from the start.

**Acceptance criteria**:
- CSV import templates for three supported entity categories only
- Import UI explicitly warns if user attempts to import in-flight-looking data (e.g., phase = "Fieldwork" or similar)
- Archived engagement imports tagged `IMPORTED_READ_ONLY` — they can be browsed, searched, and linked to future work but cannot be edited or processed through AIMS's workflow
- Historical engagement data accessible for future engagements' repeat-finding detection and prior-period references
- Customer Success runbook for each supported migration path

---

## 4. User stories — Tenant settings

### 4.1 US-TO-007 — Sofia configures tenant general settings

```gherkin
GIVEN Sofia is Tenant Admin
WHEN she opens Tenant Settings
THEN she sees tabs for:
  - General (name, logo, timezone, fiscal year, branding)
  - Users (list, invite, deactivate)
  - Roles (RBAC configuration)
  - SSO (OIDC / SAML config)
  - SCIM (v2.1 full; MVP has CSV)
  - Billing (subscription, payment, usage)
  - Data Residency (region, data-handling policies)
  - Audit Log (tenant-level audit events)
  - Notifications (tenant-wide defaults)
  - Pack Annotations (see `pack-attachment-and-annotation.md`)
  - Compliance (DPA, trust center link, subprocessor list)
  - Integrations (API keys, webhook configs)
```

### 4.2 US-TO-008 — Sofia configures tenant branding

```gherkin
WHEN Sofia uploads tenant logo
  AND sets primary brand color
  AND configures email sender domain (with DKIM verification)
THEN branding applied to:
  - Login page
  - In-app top bar
  - Email templates (outbound)
  - Report cover pages (per `report-generation.md`)
  - Auditee portal (for PBC, CAPs)
```

---

## 5. User stories — Subscription management

### 5.1 US-TO-009 — Tenant admin upgrades tier

```gherkin
GIVEN tenant is on Professional
  AND Elena (Audit Partner) wants Enterprise tier features
WHEN Sofia initiates upgrade
  AND selects Enterprise
  AND confirms prorated billing
THEN upgrade applied
  AND new Enterprise features unlocked (dedicated CSM, advanced analytics, etc.)
  AND billing prorated
  AND audit log entry
```

### 5.2 US-TO-010 — Seat management

```gherkin
GIVEN tenant has 40 Professional seats licensed
  AND current users: 38
WHEN Sofia adds 5 new users
THEN seat count updates to 43
  AND billing prorated for additional 3 seats
  AND Sofia notified of cost increase
```

---

## 6. User stories — Trust center

### 6.1 US-TO-011 — Prospect views trust center before signing

```gherkin
GIVEN prospect considering AIMS
  AND their security team reviewing
WHEN they visit trust.aims.io
THEN they see:
  - Compliance status: SOC 2 Type I (in progress; or achieved)
  - Subprocessor list
  - DPA template (downloadable)
  - Security questionnaire library (SIG Lite / CAIQ)
  - Incident response overview
  - Data residency policy
  - Encryption standards
```

**Acceptance criteria**:
- Trust center publicly accessible (no login)
- Updated automatically when subprocessor list changes
- SOC 2 report accessible post-attestation (NDA-gated)

### 6.2 US-TO-012 — Subprocessor change notification

```gherkin
GIVEN AIMS adds new subprocessor (e.g., new email service)
WHEN change happens
THEN all tenants receive 30-day notice per DPA
  AND trust center updated
  AND tenants can object (limited cases) or accept
```

---

## 7. User stories — Offboarding

### 7.1 US-TO-013 — Tenant requests offboarding

```gherkin
GIVEN customer decides to offboard
WHEN Sofia initiates offboarding in settings
  AND confirms data export option
THEN offboarding workflow:
  - Data export generated (all engagements, findings, reports, CAPs)
  - Retention hold period begins (typically 90 days)
  - Access suspended (users cannot log in)
  - Cryptographic erasure scheduled at end of hold
  - Legal review (ensure no active litigation hold)
  - Final confirmation before erasure
```

**Acceptance criteria**:
- Data export in structured format (CSV + PDF archive)
- Retention hold configurable per customer contract
- Cryptographic erasure per ADR-0001
- Evidence of offboarding preserved (audit log persists)

---

## 8. Edge cases

- Payment failure (subscription grace period; suspension after N days)
- Region migration (v2.2+) — for now, offboard + re-onboard
- On-prem deployment (v2.2+) — Helm chart delivery
- Multi-tenant parent (large firm with multiple practices) — each practice a tenant; parent billing aggregation

---

## 9. Data model

- `Tenant` — core entity
- `TenantSettings` — configuration
- `TenantSubscription` — subscription + billing
- `TenantUser` — user lifecycle
- `TenantAudit` — tenant-level events
- `Subprocessor` — subprocessor list

---

## 10. API endpoints

```typescript
tenant.signup(input: SignupInput): Tenant
tenant.getSettings(input: {tenantId}): Settings
tenant.updateSettings(input: SettingsUpdate): Settings
tenant.updateBilling(input: BillingUpdate): Subscription
tenant.offboard(input: {tenantId, dataExportFormat}): OffboardingJob
```

---

## 11. Permissions

| Role | Configure settings | Manage billing | Manage users | Offboard |
|---|---|---|---|---|
| Sofia (Tenant Admin) | ✅ | ✅ | ✅ | ✅ |
| Elena (Audit Partner) | ⚠️ (billing/contract) | ✅ | ⚠️ | ✅ |
| Marcus (CAE) | ❌ (audit domain only) | ❌ | ❌ | ❌ |
| Ravi (Platform Admin) | ⚠️ (scoped support access) | ⚠️ | ⚠️ | ⚠️ |

---

## 12. Observability

- `tenant.signup.count`
- `tenant.activation.duration` (signup to first paid)
- `tenant.offboard.count`
- `tenant.subscription.churn.rate`

---

## 13. Performance

- Tenant provisioning p99 < 60s (self-serve)
- Settings save p99 < 1s

---

## 14. Compliance

- GDPR Art. 17 right to erasure (offboarding)
- SOC 2 CC1.1-1.5 governance
- Trust center aligned with ISO 27001 Annex A

---

## 15. References

- [`03-feature-inventory.md`](../03-feature-inventory.md) Module 1
- [`02-personas.md §8`](../02-personas.md) — Sofia
- [`docs/06-design-decisions.md §6 + §4.8`](../../docs/06-design-decisions.md) — commercial model + regional silos
- [`features/identity-auth-sso.md`](identity-auth-sso.md) — SSO config

---

## 16. Domain review notes — Round 1 (April 2026)

External review flagged one refinement:

- **§3.3 US-TO-006 — migration scope**: reviewer correctly flagged that CSV import of in-flight engagements from competitor systems (TeamMate+ et al.) is operationally dangerous — their phase gates don't map cleanly to AIMS's state machines. Fix: MVP 1.0 migration explicitly scoped to three supported categories: Audit Universe entities, Staff + CPE history, Archived/read-only engagements. In-flight engagements must be finished in the legacy tool or started over in AIMS. This prevents broken-state-machine outcomes that compromise audit evidence integrity.

Phase 4 Part 2 overall verdict: **Approved**.

---

*Last reviewed: 2026-04-22. Phase 4 Part 2 deliverable; R1 review closed.*
