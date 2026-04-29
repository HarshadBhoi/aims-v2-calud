# Phase 4 — Multi-Standard Framework

> **⚠ Reconciliation 2026-04-28**: DEFERRED entirely from Slice A. Canonical multi-standard design lives at [`data-model/standard-pack-schema.ts`](../../data-model/standard-pack-schema.ts), [`data-model/examples/`](../../data-model/examples/) (GAGAS, IIA GIAS, ISO 19011, SOC 2, Single Audit overlay), and [`docs/03-the-multi-standard-insight.md`](../../docs/03-the-multi-standard-insight.md). The slice resolver returns single-pack effective values; multi-pack union with strictness direction (max/min/union/override_required) and `equivalenceStrength` annotation overlays land in Slice B+.

> **Goal**: Add IIA GIAS 2024 and SOX/PCAOB standard packs, build the crosswalk engine,
> and prove that the abstraction layer supports multiple standards simultaneously.

**Duration**: Weeks 15-20
**Dependencies**: Phase 3 (GAGAS Pack)
**Unlocks**: New market segments (internal audit, public companies)

---

## Deliverables

| # | Task | Status | Detail |
|---|------|--------|--------|
| 4.1 | IIA GIAS 2024 Standard Pack | Pending | [Detail](4.1-iia-gias.md) |
| 4.2 | SOX/PCAOB Standard Pack | Pending | [Detail](4.2-sox-pcaob.md) |
| 4.3 | Standards Crosswalk Engine | Pending | [Detail](4.3-crosswalk-engine.md) |
| 4.4 | Control Mapping (Test Once, Comply Many) | Pending | [Detail](4.4-control-mapping.md) |
| 4.5 | Multi-Standard Engagement Wizard | Pending | [Detail](4.5-engagement-wizard.md) |
| 4.6 | Standard Pack SDK | Pending | [Detail](4.6-standard-pack-sdk.md) |

---

## Definition of Done

- [ ] IIA GIAS 2024 engagement runs end-to-end (different fields, checklists, reports than GAGAS)
- [ ] SOX engagement with ICFR testing and deficiency classification works
- [ ] Single engagement tagged to both GAGAS and IIA produces correct outputs for each
- [ ] Crosswalk viewer shows mappings between all three standards
- [ ] A control tested once satisfies requirements in multiple standards
- [ ] Standard Pack SDK documentation enables third-party pack creation
