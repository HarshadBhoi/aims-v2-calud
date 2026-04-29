# Phase 6 — Reporting & Analytics

> **⚠ Reconciliation 2026-04-28**: PARTIALLY EXERCISED. Slice A W4 (next) ships the minimum report path — `report.create / submitForSignoff / sign`, NestJS worker for PDF render, presigned-URL download, and the audit log viewer. Dashboards, materialized views, and richer analytics are deferred. Canonical narrative: [`product/api-catalog.md`](../../product/api-catalog.md) and the report-related entries under [`product/features/`](../../product/features/) and [`product/ux/`](../../product/ux/).

> **Goal**: Powerful reporting engine, dashboards, and data analytics.
> Reports are the primary output of audit work — they must be excellent.

**Duration**: Weeks 27-30
**Dependencies**: Phase 3 (GAGAS Pack — for first report templates)
**Can run in parallel with**: Phase 4, Phase 5

---

## Deliverables

| # | Task | Status | Detail |
|---|------|--------|--------|
| 6.1 | Dashboard & KPI Engine | Pending | [Detail](6.1-dashboard.md) |
| 6.2 | PDF Report Engine (Multi-Standard) | Pending | [Detail](6.2-pdf-engine.md) |
| 6.3 | Annual Summary Report | Pending | [Detail](6.3-annual-report.md) |
| 6.4 | Custom Report Builder | Pending | [Detail](6.4-custom-reports.md) |
| 6.5 | Data Export & Integration API | Pending | [Detail](6.5-data-export.md) |
| 6.6 | Analytics & Trend Analysis | Pending | [Detail](6.6-analytics.md) |

---

## Definition of Done

- [ ] Executive dashboard with real-time KPIs
- [ ] PDF generation for every report type, per standard
- [ ] Annual summary report with auto-aggregated data
- [ ] Custom report builder for ad-hoc reporting
- [ ] Data export (CSV, Excel, PDF) for all major entities
- [ ] REST API for third-party tool integration
- [ ] Trend analysis charts (findings over time, risk trends, audit coverage)
