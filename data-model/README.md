# Standard Pack Data Model

> The data model at the heart of the AIMS v2 multi-standard audit platform.

## What is a Standard Pack?

A **Standard Pack** is a versioned configuration module that defines everything needed for an audit framework — terminology, engagement types, finding elements, checklists, workflows, templates, and crosswalks. The audit engine is standard-agnostic; Standard Packs provide the rules.

**One Standard Pack = One version of one audit framework.** For example:
- `GAGAS:2024` (effective Dec 15, 2025)
- `GAGAS:2018` (still valid for legacy audits)
- `IIA_GIAS:2024` (effective Jan 9, 2025)
- `IIA_IPPF:2017` (transition period through Jan 9, 2025)
- `ISO_27001:2022` (effective; 2013 version expired Oct 31, 2025)
- `SOX_PCAOB:2024` (with QC 1000 postponed to Dec 15, 2026)

## File Structure

```
data-model/
├── README.md                        ← You are here
├── standard-pack-schema.ts          ← Complete TypeScript interfaces
├── standard-pack-schema.json        ← JSON Schema for runtime validation
├── VALIDATION.md                    ← Rules for pack completeness
└── examples/
    ├── gagas-2024.ts                ← GAGAS 2024 populated pack
    ├── iia-gias-2024.ts             ← IIA GIAS 2024 populated pack
    └── iso-19011-2018.ts            ← ISO 19011:2018 minimal pack
```

## Design Principles

1. **Type safety end-to-end** — TypeScript interfaces compile; JSON Schema validates at runtime
2. **Versioning as first-class** — Every pack has immutable version; upgrades create new versions
3. **Effective date ranges** — Packs have `effectiveFrom` and optional `effectiveTo`
4. **Dependency resolution** — Packs can require or incorporate other packs (e.g., GAGAS → AICPA AU-C)
5. **Conditional applicability** — Rules can apply based on engagement type, jurisdiction, entity size
6. **Extensibility** — Adding a new standard doesn't require schema changes
7. **Internationalization ready** — Labels support multiple locales (future)
8. **Tenant customization** — Packs can be overridden per tenant

## How Standard Packs Drive the Engine

```
┌──────────────────────────────────────────┐
│  Engagement Creation                     │
│  User selects: GAGAS 2024 + Performance  │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Pack Resolver                           │
│  Loads: GAGAS:2024 + AICPA_AUC:current   │
└──────────────┬───────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────┐
│  Engine Configuration                    │
│  - Terminology: "Auditor-in-Charge", etc │
│  - Finding form: 4 elements (§6.39)      │
│  - QA checklist: 60+ items               │
│  - Workflow: 5-stage approval            │
│  - Report template: §6.02 sections       │
└──────────────────────────────────────────┘
```

## Usage (Conceptual)

```typescript
import { gagas2024 } from '@aims/standard-packs/gagas-2024';
import { validatePack } from '@aims/standard-packs/validator';

// Validate at build time
validatePack(gagas2024); // throws if invalid

// Resolve for an engagement
const engine = createEngine({
  primaryStandard: gagas2024,
  additionalStandards: [iiaGias2024], // multi-standard
  engagementType: 'PERFORMANCE_AUDIT',
});

// Engine now knows:
engine.getTerminology();        // GAGAS-specific labels
engine.getFindingElements();    // 4 elements (Criteria, Condition, Cause, Effect)
engine.getWorkflow('finding');  // GAGAS finding approval workflow
engine.generateReport();        // GAGAS §6.02 report structure
```

## Verification Basis

All example packs reference verified authoritative sources (see `../references/VERIFICATION-UPDATE-2026.md`). Standard-specific content was derived from:

- **GAGAS 2024**: GAO 2024 Yellow Book (gao.gov)
- **IIA GIAS 2024**: theiia.org official standards
- **ISO 19011:2018**: ISO standard text
- **PCAOB standards**: pcaobus.org
- **SEC regulations**: sec.gov

Where specific paragraph references are used, they're marked with the source for future verification.

## Status

- [x] Schema design (TypeScript + JSON Schema)
- [x] Example: GAGAS 2024 pack
- [x] Example: IIA GIAS 2024 pack
- [x] Example: ISO 19011:2018 pack
- [x] Validation rules
- [ ] Additional packs: SOX/PCAOB, COBIT 2019, NIST CSF 2.0 (future)
- [ ] Pack composition / dependency resolver implementation (Phase 2.1)
- [ ] Tenant override mechanism (Phase 1.5)
