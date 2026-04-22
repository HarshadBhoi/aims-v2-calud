# Standard Pack Validation Rules

> Rules for validating that a Standard Pack is complete and consistent before it can be activated for tenants.

---

## Validation Layers

Standard Pack validation happens at **three layers**:

1. **Schema validation** (automatic) — structural conformance via `standard-pack-schema.json`
2. **Semantic validation** (programmatic) — rules beyond structure (e.g., referenced codes exist)
3. **Content review** (manual) — domain expert verification of paragraph citations, regulatory accuracy

---

## Layer 1: Schema Validation (Automatic)

Run JSON Schema validation on every pack:

```typescript
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import schema from './standard-pack-schema.json';
import { gagas2024 } from './examples/gagas-2024';

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);

const validate = ajv.compile(schema);
const valid = validate(gagas2024);

if (!valid) {
  console.error('Pack validation failed:', validate.errors);
}
```

### Schema-Enforced Rules
- All `required` top-level fields present
- `code` matches `^[A-Z][A-Z0-9_]*$`
- `version` is a non-empty string
- `schemaVersion` is exactly `"1.1.0"`
- `packType` is one of `"methodology"`, `"control_framework"`, or `"regulatory_overlay"`
- `effectiveFrom` is a valid ISO 8601 date
- `status` is one of the enum values
- `semanticElementMappings` is present (may be empty for packs with no findings, e.g., pure regulatory overlays without their own finding schema)
- At least one engagement type, phase, finding element, classification scheme, workflow, and report definition (for `methodology` packs)

---

## Layer 2: Semantic Validation (Programmatic)

Rules not expressible in JSON Schema alone:

### 2.1 Referential Integrity

```typescript
function validateReferentialIntegrity(pack: StandardPack): ValidationError[] {
  const errors: ValidationError[] = [];

  // Every engagementType.defaultWorkflowCode must exist in pack.workflows
  for (const et of pack.engagementTypes) {
    if (!pack.workflows.find(w => w.code === et.defaultWorkflowCode)) {
      errors.push({
        path: `engagementTypes[${et.code}].defaultWorkflowCode`,
        message: `Workflow "${et.defaultWorkflowCode}" not found in pack.workflows`,
      });
    }

    // Every applicablePhase must exist
    for (const phaseCode of et.applicablePhases) {
      if (!pack.phases.find(p => p.code === phaseCode)) {
        errors.push({
          path: `engagementTypes[${et.code}].applicablePhases`,
          message: `Phase "${phaseCode}" not found in pack.phases`,
        });
      }
    }

    // Every requiredTemplate must exist
    for (const templateCode of et.requiredTemplates) {
      if (!pack.templates.find(t => t.code === templateCode)) {
        errors.push({
          path: `engagementTypes[${et.code}].requiredTemplates`,
          message: `Template "${templateCode}" not found in pack.templates`,
        });
      }
    }

    // Every requiredChecklist must exist
    for (const checklistCode of et.requiredChecklists) {
      if (!pack.checklists.find(c => c.code === checklistCode)) {
        errors.push({
          path: `engagementTypes[${et.code}].requiredChecklists`,
          message: `Checklist "${checklistCode}" not found in pack.checklists`,
        });
      }
    }
  }

  // Every workflow.entityType must be valid
  // Every reportDefinition.requiredForEngagementTypes must reference valid types
  for (const rd of pack.reportDefinitions) {
    for (const etCode of rd.requiredForEngagementTypes) {
      if (!pack.engagementTypes.find(et => et.code === etCode)) {
        errors.push({
          path: `reportDefinitions[${rd.code}].requiredForEngagementTypes`,
          message: `Engagement type "${etCode}" not found in pack.engagementTypes`,
        });
      }
    }
  }

  return errors;
}
```

### 2.2 Uniqueness

All codes within their respective collections must be unique:
- `engagementTypes[].code`
- `phases[].code`
- `findingElements[].code`
- `findingClassifications[].code` and within each scheme, `levels[].code`
- `checklists[].code`
- `workflows[].code`
- `reportDefinitions[].code`
- `templates[].code`

### 2.3 Ordering

- `phases[].order` must be unique and sequential from 1
- `findingElements[].order` must be unique
- `workflow.steps[].order` must be unique and sequential from 1
- `reportDefinition.sections[].order` must be unique
- `template.sections[].order` must be unique
- `checklist.sections[].order` must be unique; within each section `items[].order` must be unique

### 2.4 Classification Scheme

- `findingClassifications[].levels` must have at least 2 levels
- Levels must have unique `severity` values OR can have equal severity if intentional (document in notes)

### 2.5 Workflow Consistency

- Every `workflow.steps` array must have at least one step
- `step.order` 1 should be first; no gaps in ordering
- At least one step must have `allowedActions` including `"approve"`

### 2.6 Date Consistency

- `meta.effectiveTo` (if present) must be after `meta.effectiveFrom`
- `meta.transitionDeadline` (if present) must be before or equal to `meta.effectiveFrom`
- `applicability.thresholds[].supersededOn` (if present) must be after `effectiveFrom`

### 2.7 Dependency References

- `dependencies[].standardRef` must follow `CODE:version` format
- Referenced packs SHOULD exist in the pack registry (warning if not — for extensibility)

### 2.8 CPE Rules Consistency

- If `cpeRules.cycleType` is multi-year, `annualMinimum` × cycle years ≤ `hoursRequired`
- Sum of `topicRequirements[].hoursRequired` ≤ `hoursRequired`

### 2.9 Independence Rules

- If `partnerRotationYears` is set, must be > 0
- `declarationForm.sections` must have at least one section
- Each section's `questions` must have at least one question

---

## Layer 3: Content Review (Manual)

The following require domain expert sign-off before production release:

### 3.1 Paragraph Citations
Every `referenceSection` field should be verified against:
- **GAGAS 2024**: GAO 2024 Yellow Book (gao.gov)
- **IIA GIAS 2024**: theiia.org official publication
- **PCAOB**: pcaobus.org standards
- **ISO**: ISO/IEC 19011:2018 text
- **COBIT**: ISACA COBIT 2019 publication

Verification workflow:
1. Export all references from pack
2. Cross-check against primary source
3. Flag any references that cannot be located
4. Update pack to reflect verified references

### 3.2 Terminology
- Verify terms match current industry usage
- Confirm aliases don't conflict with other standards' terms
- Check for deprecated terminology (e.g., "Chief Audit Executive" vs older "Director of Internal Audit")

### 3.3 Workflow Realism
- Review with practicing auditors
- Confirm role names match industry norms
- Verify step counts aren't excessive or insufficient

### 3.4 Classification Accuracy
- Color codes should follow accessibility guidelines
- Severity levels must align with regulatory expectations
- Escalation flags should match real-world consequences

### 3.5 Regulatory Currency
Pack should include a `meta.reviewDate` (not in schema yet — consider adding) indicating last content review. Recommended cadence:
- **Annual review** for active packs
- **Immediate review** when regulatory status changes (e.g., SEC Climate Rule withdrawn)
- **Re-verification** when dependent standards update

---

## Layer 4: Cross-Pack Consistency

When multiple packs exist in the system:

### 4.1 Code Collisions
Pack codes (e.g., `GAGAS`, `IIA_GIAS`) should be globally unique (case-insensitive).

### 4.2 Version Uniqueness
For a given `code`, versions should be unique. `GAGAS:2024` exists once.

### 4.3 Crosswalk Bi-Directionality
If Pack A has a crosswalk to Pack B, Pack B should have a corresponding crosswalk (or one should be generated). Inconsistent crosswalks are a data quality issue.

### 4.4 Dependency Resolution
All `dependencies[].standardRef` should resolve to packs present in the registry. If not, surface as warning — some dependencies may be external standards not yet packaged.

### 4.5 Semantic Element Mapping Integrity (new — schema v1.1.0)
Per `references/multi-standard-design.md §4`:

- Every `packElementCode` in `semanticElementMappings` must reference an existing `findingElements[].code` in the same pack. Fail the pack if a mapping points to a non-existent element code.
- A pack SHOULD provide mappings for the classical quartet (`CRITERIA`, `CONDITION`, `CAUSE`, `EFFECT`) if `packType === 'methodology'` and the pack defines finding elements. Warn (don't fail) if any are missing — some methodology packs legitimately omit (e.g., ISO 19011 does not require EFFECT).
- Two packs may both claim `semanticCode: 'CRITERIA'` — that's the point. Different `equivalenceStrength` values across packs are fine and expected.
- If `equivalenceStrength !== 'exact'`, the mapping SHOULD include `notes` explaining the divergence. Warn on missing notes for non-exact mappings.
- Pack authors MAY introduce new `SemanticElementCode` values (e.g., COBIT's `CAPABILITY_GAP`). Validator warns when a pack uses a code not in the shipped baseline enum, to flag that other packs' reports won't know how to render this element.

---

## Layer 5: Multi-Standard Engagement Validation (tenant data, not pack data)

Applies to `Engagement` records (see `tenant-data-model.ts`). Not part of pack validation, but documented here for completeness of the schema rules.

### 5.1 Primary Methodology Pack Type
`Engagement.primaryMethodology` MUST resolve to a pack with `packType === 'methodology'`. Reject at engagement creation otherwise.

### 5.2 Additional Methodology Pack Type
Every ref in `Engagement.additionalMethodologies[]` MUST resolve to a pack with `packType === 'methodology'`. A control framework or regulatory overlay cannot be an additional methodology.

### 5.3 Control Framework Pack Type
Every ref in `Engagement.controlFrameworks[]` MUST resolve to a pack with `packType === 'control_framework'`.

### 5.4 Regulatory Overlay Pack Type
Every ref in `Engagement.regulatoryOverlays[]` MUST resolve to a pack with `packType === 'regulatory_overlay'`. Overlays must declare dependencies via `StandardDependency` if they extend a methodology (e.g., Single Audit depends on GAGAS).

### 5.5 Engagement Mode Consistency
The `engagementMode` value should be consistent with the pack structure:
- `single` — zero additionalMethodologies, zero overlays
- `integrated` — exactly two methodologies where one is PCAOB AS 2201 (integrated FS + ICFR)
- `statutory_stacked` — at least one regulatory overlay whose dependency chain requires the primary methodology (e.g., Single Audit requires GAGAS)
- `combined` — multiple `control_framework` packs (ISO IMS pattern per IAF MD 11)
- `in_conjunction` — at least one additionalMethodology explicitly permitted by the primary's cross-standard provisions (e.g., GAGAS's "in conjunction with" language)

Warn (don't fail) on inconsistency; let the auditor explicitly override if their combination is valid but non-standard.

### 5.6 Conformance Claim Integrity
If `StandardPackRef.conformanceClaimed === true` for a methodology pack, the engagement's audit function MUST satisfy that pack's function-level requirements (e.g., IIA GIAS Std 15.1 requires QAIP with external assessment every 5 years). This is checked at report-generation time, not engagement-creation time. Warn at creation; fail at issuance.

### 5.7 Strictness Resolver Consistency
`Engagement.strictness` (if present) must be re-derivable from the currently attached packs. On pack attach/detach, recompute and persist. Flag if stored value disagrees with computed value (drift detector).

---

## Validation Helper Functions

Recommended implementation helpers:

```typescript
// packages/standard-pack-validator/src/index.ts

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export function validatePack(pack: StandardPack): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Schema validation
  errors.push(...validateSchema(pack));

  // Semantic validation
  errors.push(...validateReferentialIntegrity(pack));
  errors.push(...validateUniqueness(pack));
  errors.push(...validateOrdering(pack));
  errors.push(...validateDateConsistency(pack));
  errors.push(...validateCPERules(pack));

  // Warnings (non-blocking)
  warnings.push(...checkContentFreshness(pack));
  warnings.push(...checkCrosswalkCompleteness(pack));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateCrossPackConsistency(
  packs: StandardPack[]
): ValidationResult {
  // Check code collisions, version uniqueness, crosswalk bi-directionality
  // ...
}
```

---

## Required for Production Activation

Before a pack can be activated for production tenants:

- [ ] All Layer 1 (schema) errors resolved
- [ ] All Layer 2 (semantic) errors resolved
- [ ] Layer 3 (content) review completed by domain expert
- [ ] Layer 4 (cross-pack) warnings reviewed
- [ ] Pack has `status` set to `EFFECTIVE` (or `FINAL_PENDING` with early adoption)
- [ ] Effective date is in the past OR early adoption is allowed
- [ ] Change log documents differences from prior version
- [ ] Test engagement successfully runs end-to-end against the pack

---

## Example: Validating GAGAS 2024

```bash
# CLI tool (future implementation)
$ aims-pack validate ./examples/gagas-2024.ts

✓ Schema validation passed
✓ Referential integrity passed
✓ Uniqueness passed
✓ Ordering passed
✓ Date consistency passed
✓ CPE rules consistent

⚠ Warnings (2):
  - Pack has no review date metadata (add meta.reviewDate)
  - 4 crosswalk entries have confidence: "curated" — consider upgrading to "authoritative"

Result: VALID (2 warnings)
```

---

## Schema Versioning Strategy

The `schemaVersion` field on StandardPack enables schema evolution:

- **1.0.0**: Initial release (current)
- **1.1.0**: Backward-compatible additions (e.g., new optional fields)
- **2.0.0**: Breaking changes (e.g., required field rename)

When schema changes:
1. Bump schema version
2. Provide migration function `migratePack(pack, fromVersion, toVersion)`
3. Update all existing packs via migration
4. Validate all packs against new schema

Packs MUST include `schemaVersion` so the loader knows which validator to apply.
