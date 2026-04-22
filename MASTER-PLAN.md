# AIMS v2 — Multi-Standard Audit Platform

## Master Plan

---

## Vision

Transform AIMS from a GAGAS-only SharePoint-dependent audit tool into an **independent, multi-standard, enterprise-grade Audit Information Management Platform** that organizations can configure for any audit framework worldwide.

**One platform. Any standard. Any organization.**

---

## Target Market

| Segment | Standards | Examples |
|---------|-----------|----------|
| US Government (Federal/State/Local) | GAGAS (Yellow Book), Uniform Guidance | GAO, OIGs, State Auditors |
| Public Listed Companies | SOX/PCAOB, IIA GIAS 2024 | Fortune 500 internal audit |
| International Government | ISSAI, INTOSAI | National audit offices worldwide |
| IT Audit | COBIT, ISO 27001, NIST | IT audit teams, cybersecurity |
| Quality & Compliance | ISO 19011, ISO 9001 | Manufacturing, healthcare |
| Financial Services | Basel, FFIEC, AML | Banks, insurance, fintech |
| Healthcare | HIPAA, SOC 2 | Hospitals, health systems |
| ESG / Sustainability | ISSB, CSRD, GRI | Listed companies, ESG reporters |

---

## Phase Overview

### Phase 1 — Foundation (Weeks 1-4)
> **Goal**: Project setup, database, auth, and base UI shell

- [1.1 Project Setup & Monorepo](phases/phase-1-foundation/1.1-project-setup.md)
- [1.2 Database Schema & ORM](phases/phase-1-foundation/1.2-database-schema.md)
- [1.3 Authentication & Authorization](phases/phase-1-foundation/1.3-auth-system.md)
- [1.4 UI Shell & Design System](phases/phase-1-foundation/1.4-ui-shell.md)
- [1.5 Multi-Tenancy Architecture](phases/phase-1-foundation/1.5-multi-tenancy.md)
- [1.6 File Storage Service](phases/phase-1-foundation/1.6-file-storage.md)

### Phase 2 — Core Audit Engine (Weeks 5-10)
> **Goal**: Standard-agnostic audit engine — the heart of the platform

- [2.1 Standards Abstraction Layer](phases/phase-2-core-engine/2.1-standards-abstraction.md)
- [2.2 Engagement Management](phases/phase-2-core-engine/2.2-engagements.md)
- [2.3 Planning & Risk Assessment](phases/phase-2-core-engine/2.3-planning.md)
- [2.4 Fieldwork & Evidence](phases/phase-2-core-engine/2.4-fieldwork.md)
- [2.5 Findings & Recommendations](phases/phase-2-core-engine/2.5-findings.md)
- [2.6 Workflow & Approval Engine](phases/phase-2-core-engine/2.6-workflows.md)
- [2.7 Workpaper Management](phases/phase-2-core-engine/2.7-workpapers.md)

### Phase 3 — GAGAS Standard Pack (Weeks 11-14)
> **Goal**: First standard implementation — port AIMS v1 GAGAS features

- [3.1 GAGAS Configuration Module](phases/phase-3-gagas-standard/3.1-gagas-config.md)
- [3.2 GAGAS Templates & Checklists](phases/phase-3-gagas-standard/3.2-gagas-templates.md)
- [3.3 GAGAS Independence & Ethics](phases/phase-3-gagas-standard/3.3-gagas-independence.md)
- [3.4 GAGAS QA & Peer Review](phases/phase-3-gagas-standard/3.4-gagas-qa.md)
- [3.5 GAGAS Report Generation](phases/phase-3-gagas-standard/3.5-gagas-reports.md)
- [3.6 GAGAS Compliance Crosswalk](phases/phase-3-gagas-standard/3.6-gagas-crosswalk.md)
- [3.7 Migration from AIMS v1](phases/phase-3-gagas-standard/3.7-v1-migration.md)

### Phase 4 — Multi-Standard Framework (Weeks 15-20)
> **Goal**: Add second/third standards, prove the abstraction layer works

- [4.1 IIA GIAS 2024 Standard Pack](phases/phase-4-multi-standard/4.1-iia-gias.md)
- [4.2 SOX/PCAOB Standard Pack](phases/phase-4-multi-standard/4.2-sox-pcaob.md)
- [4.3 Standards Crosswalk Engine](phases/phase-4-multi-standard/4.3-crosswalk-engine.md)
- [4.4 Control Mapping (Test Once, Comply Many)](phases/phase-4-multi-standard/4.4-control-mapping.md)
- [4.5 Multi-Standard Engagement Wizard](phases/phase-4-multi-standard/4.5-engagement-wizard.md)
- [4.6 Standard Pack SDK (Build Your Own)](phases/phase-4-multi-standard/4.6-standard-pack-sdk.md)

### Phase 5 — Advanced Features (Weeks 21-26)
> **Goal**: Enterprise features that differentiate the platform

- [5.1 Audit Universe & Risk-Based Planning](phases/phase-5-advanced-features/5.1-audit-universe.md)
- [5.2 Staff, Time & CPE Tracking](phases/phase-5-advanced-features/5.2-staff-time-cpe.md)
- [5.3 Corrective Action Plan (CAP) Tracking](phases/phase-5-advanced-features/5.3-cap-tracking.md)
- [5.4 Real-Time Collaboration](phases/phase-5-advanced-features/5.4-collaboration.md)
- [5.5 Notifications & Email Engine](phases/phase-5-advanced-features/5.5-notifications.md)
- [5.6 Audit Trail & Immutable Logging](phases/phase-5-advanced-features/5.6-audit-trail.md)
- [5.7 E-Signatures & Digital Sign-Off](phases/phase-5-advanced-features/5.7-e-signatures.md)

### Phase 6 — Reporting & Analytics (Weeks 27-30)
> **Goal**: Powerful reporting, dashboards, and data export

- [6.1 Dashboard & KPI Engine](phases/phase-6-reporting-analytics/6.1-dashboard.md)
- [6.2 PDF Report Engine (Multi-Standard)](phases/phase-6-reporting-analytics/6.2-pdf-engine.md)
- [6.3 Annual Summary Report](phases/phase-6-reporting-analytics/6.3-annual-report.md)
- [6.4 Custom Report Builder](phases/phase-6-reporting-analytics/6.4-custom-reports.md)
- [6.5 Data Export & Integration API](phases/phase-6-reporting-analytics/6.5-data-export.md)
- [6.6 Analytics & Trend Analysis](phases/phase-6-reporting-analytics/6.6-analytics.md)

### Phase 7 — Enterprise & SaaS (Weeks 31-36)
> **Goal**: Production-ready SaaS platform

- [7.1 Multi-Tenant Administration](phases/phase-7-enterprise-saas/7.1-tenant-admin.md)
- [7.2 Subscription & Billing](phases/phase-7-enterprise-saas/7.2-billing.md)
- [7.3 SSO & Enterprise Identity](phases/phase-7-enterprise-saas/7.3-sso.md)
- [7.4 Data Residency & Compliance](phases/phase-7-enterprise-saas/7.4-data-residency.md)
- [7.5 CI/CD & DevOps Pipeline](phases/phase-7-enterprise-saas/7.5-cicd.md)
- [7.6 Monitoring, Logging & Alerting](phases/phase-7-enterprise-saas/7.6-monitoring.md)
- [7.7 Documentation & Onboarding](phases/phase-7-enterprise-saas/7.7-documentation.md)
- [7.8 Mobile App (PWA / React Native)](phases/phase-7-enterprise-saas/7.8-mobile.md)

---

## Phase Dependency Map

```
Phase 1 ─── Foundation
  │
  ▼
Phase 2 ─── Core Audit Engine (standard-agnostic)
  │
  ├──▶ Phase 3 ─── GAGAS Pack (first standard, proves the engine)
  │       │
  │       ▼
  │    Phase 4 ─── Multi-Standard (adds IIA, SOX, crosswalks)
  │
  ├──▶ Phase 5 ─── Advanced Features (can start after Phase 2)
  │
  ├──▶ Phase 6 ─── Reporting (can start after Phase 3)
  │
  └──▶ Phase 7 ─── Enterprise/SaaS (can start after Phase 5)
```

**Parallelization**: Phases 5 and 6 can run in parallel with Phase 4.
Phase 7 can begin once Phase 5 is stable.

---

## What Carries Over from AIMS v1

| Asset | Reusable? | Notes |
|-------|-----------|-------|
| Domain knowledge (GAGAS) | 100% | The most valuable asset |
| React components | ~70% | Restyle for new design system, logic reusable |
| Form validation (Zod schemas) | ~90% | Port directly |
| PDF templates (pdfmake) | ~80% | Adapt for multi-standard |
| Business logic / rules | ~85% | Engagement lifecycle, approval flows |
| Models / Interfaces | ~60% | Refactor for multi-tenancy + standards |
| SharePointService.ts | 0% | Replaced by API layer |
| SPFx shell / PnPjs | 0% | Not needed |
| SP List schemas | ~40% | Inform database table design |

---

## Tech Stack

See [TECH-STACK.md](TECH-STACK.md) for full details and rationale.

---

## Success Metrics (MVP)

- [ ] GAGAS engagement runs end-to-end on the new platform
- [ ] At least 2 standards configured and functional
- [ ] Crosswalk between GAGAS and IIA GIAS 2024 demonstrated
- [ ] Multi-tenant isolation verified
- [ ] PDF reports generate for each configured standard
- [ ] AIMS v1 data migrated successfully
- [ ] Performance: <2s page loads, <500ms API responses
- [ ] Zero critical security vulnerabilities
