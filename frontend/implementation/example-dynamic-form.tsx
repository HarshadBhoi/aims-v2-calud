/**
 * REFERENCE IMPLEMENTATION — Dynamic Form Engine (Finding Form)
 *
 * THIS IS THE MOST IMPORTANT FRONTEND COMPONENT. It renders Finding forms for
 * any audit standard (GAGAS, IIA GIAS, SOX, ISO, COBIT) by consuming the
 * `findingElements` definition from the engagement's Standard Pack.
 *
 *   GAGAS 2024 finding       → 4 elements   (criteria, condition, cause, effect)
 *   IIA GIAS 2024 finding    → 5 elements   (+ recommendation)
 *   SOX/PCAOB finding        → 3–6 elements (control-type dependent)
 *   ISO 19011 finding        → 3 elements   (description, evidence, conclusion)
 *   Custom tenant packs      → any N fields defined by pack author
 *
 * The form is DATA-DRIVEN. There is no per-standard code branch. Add a new
 * standard pack → add findingElements JSON → done.
 *
 * Key subsystems demonstrated:
 *   1. FieldDefinition type system (see STATE-AND-DATA.md §6)
 *   2. Dynamic Zod schema construction (buildDynamicSchema)
 *   3. Conditional field visibility evaluator
 *   4. Field type → component registry
 *   5. Layout spanning (1/2/3-column + full-width)
 *   6. Field-level permission enforcement (readOnly, hidden)
 *   7. Autosave to draft store
 *   8. Optimistic update + server error mapping to field errors
 */

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1 — FIELD DEFINITION TYPE SYSTEM
// FILE: lib/dynamic-form/types.ts
// ═════════════════════════════════════════════════════════════════════════════

import type { Control, ControllerRenderProps, FieldPath } from "react-hook-form";
import { z } from "zod";

export type FieldType =
  | "text"
  | "textarea"
  | "rich-text"
  | "number"
  | "currency"
  | "percentage"
  | "date"
  | "date-range"
  | "select"
  | "multi-select"
  | "radio-group"
  | "checkbox"
  | "checkbox-group"
  | "switch"
  | "file-upload"
  | "file-upload-multi"
  | "user-picker"
  | "reference"
  | "rating"
  | "severity"
  | "section"
  | "divider"
  | "custom";

export interface LocalizedString {
  [locale: string]: string;
}

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;           // regex string
  patternMessage?: LocalizedString;
  /** Predefined semantic validators (e.g., "non-empty-rich-text"). */
  custom?: string;
}

export type ConditionalOperator =
  | "eq" | "neq" | "in" | "notIn"
  | "gt" | "gte" | "lt" | "lte"
  | "truthy" | "falsy" | "empty" | "nonEmpty";

export interface Conditional {
  field: string;
  op: ConditionalOperator;
  value?: unknown;
  /** How to handle when condition is false. Default: "hide". */
  mode?: "hide" | "disable" | "require";
}

export interface FieldOption {
  value: string;
  label: LocalizedString;
  description?: LocalizedString;
}

export interface FieldDefinition {
  /** Stable key — persisted in elementValues JSONB. Do not rename once published. */
  code: string;
  label: LocalizedString;
  helpText?: LocalizedString;
  placeholder?: LocalizedString;
  type: FieldType;
  required?: boolean;
  readOnly?: boolean;
  defaultValue?: unknown;
  options?: FieldOption[];
  validation?: FieldValidation;
  conditional?: Conditional;
  layout?: {
    cols?: 1 | 2 | 3 | "full";
    order?: number;
    sectionCode?: string;
  };
  /** Reference/user-picker config. */
  referenceTarget?: "finding" | "recommendation" | "risk" | "control" | "user";
  /** Escape hatch — pack can inject a custom renderer id resolved at runtime. */
  customRendererId?: string;
}

export interface FormValues {
  [code: string]: unknown;
}

export interface FieldComponentProps<T extends FieldType = FieldType> {
  field: FieldDefinition & { type: T };
  control: Control<FormValues>;
  name: FieldPath<FormValues>;
  readOnly?: boolean;
  locale: string;
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2 — DYNAMIC SCHEMA BUILDER
// FILE: lib/dynamic-form/build-schema.ts
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Build a Zod schema from a FieldDefinition array.
 *
 * The schema:
 *   - Enforces `required` / `optional`
 *   - Applies `validation` rules (min/max length, min/max number, regex)
 *   - Handles conditional required (via superRefine)
 *
 * This schema is the single source of truth for client validation. The server
 * MUST re-validate with the same schema (shared from packages/validation/).
 */
export function buildDynamicSchema(fields: FieldDefinition[]): z.ZodType<FormValues> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    if (field.type === "section" || field.type === "divider") continue;

    let schema: z.ZodTypeAny = baseSchemaFor(field);

    if (!field.required) {
      schema = schema.optional().nullable();
    }

    shape[field.code] = schema;
  }

  const base = z.object(shape);

  // Conditional required rules — if field A === X, field B is required.
  return base.superRefine((values, ctx) => {
    for (const field of fields) {
      if (!field.conditional || field.conditional.mode !== "require") continue;
      if (!evaluateConditional(field.conditional, values)) continue;

      const v = values[field.code];
      if (v === undefined || v === null || v === "") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field.code],
          message: `Required when ${field.conditional.field} ${field.conditional.op} ${String(field.conditional.value)}`,
        });
      }
    }
  });
}

function baseSchemaFor(field: FieldDefinition): z.ZodTypeAny {
  switch (field.type) {
    case "text":
    case "textarea": {
      let s = z.string();
      if (field.validation?.minLength != null) s = s.min(field.validation.minLength);
      if (field.validation?.maxLength != null) s = s.max(field.validation.maxLength);
      if (field.validation?.pattern) s = s.regex(new RegExp(field.validation.pattern));
      return s;
    }
    case "rich-text": {
      // Rich text: HTML string. Enforce min non-whitespace length via refine.
      let s = z.string();
      if (field.validation?.maxLength != null) s = s.max(field.validation.maxLength);
      if (field.required) {
        s = s.refine((v) => stripHtml(v).trim().length > 0, {
          message: "Required",
        });
      }
      return s;
    }
    case "number":
    case "currency":
    case "percentage": {
      let s = z.number();
      if (field.validation?.min != null) s = s.min(field.validation.min);
      if (field.validation?.max != null) s = s.max(field.validation.max);
      return s;
    }
    case "date":
      return z.coerce.date();
    case "date-range":
      return z.object({ from: z.coerce.date(), to: z.coerce.date() });
    case "select":
    case "radio-group":
    case "severity":
    case "rating":
      return z.string();
    case "multi-select":
    case "checkbox-group":
      return z.array(z.string());
    case "checkbox":
    case "switch":
      return z.boolean();
    case "file-upload":
      return z.object({ id: z.string(), filename: z.string() });
    case "file-upload-multi":
      return z.array(z.object({ id: z.string(), filename: z.string() }));
    case "user-picker":
    case "reference":
      return z.string();
    case "custom":
      return z.unknown();
    default:
      return z.unknown();
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3 — CONDITIONAL EVALUATOR
// FILE: lib/dynamic-form/evaluate-conditional.ts
// ═════════════════════════════════════════════════════════════════════════════

export function evaluateConditional(
  cond: Conditional,
  values: FormValues
): boolean {
  const actual = values[cond.field];
  switch (cond.op) {
    case "eq":        return deepEqual(actual, cond.value);
    case "neq":       return !deepEqual(actual, cond.value);
    case "in":        return Array.isArray(cond.value) && cond.value.includes(actual as never);
    case "notIn":     return !(Array.isArray(cond.value) && cond.value.includes(actual as never));
    case "gt":        return typeof actual === "number" && actual > (cond.value as number);
    case "gte":       return typeof actual === "number" && actual >= (cond.value as number);
    case "lt":        return typeof actual === "number" && actual < (cond.value as number);
    case "lte":       return typeof actual === "number" && actual <= (cond.value as number);
    case "truthy":    return Boolean(actual);
    case "falsy":     return !actual;
    case "empty":     return actual === undefined || actual === null || actual === "" || (Array.isArray(actual) && actual.length === 0);
    case "nonEmpty":  return actual !== undefined && actual !== null && actual !== "" && !(Array.isArray(actual) && actual.length === 0);
    default:          return true;
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4 — FIELD REGISTRY (type → component)
// FILE: components/patterns/dynamic-form/field-registry.tsx
// ═════════════════════════════════════════════════════════════════════════════

("use client");

import { TextField } from "./fields/text-field";
import { TextAreaField } from "./fields/textarea-field";
import { RichTextField } from "./fields/rich-text-field";
import { NumberField } from "./fields/number-field";
import { DateField } from "./fields/date-field";
import { DateRangeField } from "./fields/date-range-field";
import { SelectField } from "./fields/select-field";
import { MultiSelectField } from "./fields/multi-select-field";
import { RadioGroupField } from "./fields/radio-group-field";
import { CheckboxField } from "./fields/checkbox-field";
import { CheckboxGroupField } from "./fields/checkbox-group-field";
import { SwitchField } from "./fields/switch-field";
import { FileUploadField } from "./fields/file-upload-field";
import { UserPickerField } from "./fields/user-picker-field";
import { ReferenceField } from "./fields/reference-field";
import { RatingField } from "./fields/rating-field";
import { SeverityField } from "./fields/severity-field";
import { SectionHeader } from "./fields/section-header";
import { Divider } from "./fields/divider";
import { CustomFieldProxy } from "./fields/custom-field-proxy";

export const FieldRegistry: Record<
  FieldType,
  React.FC<FieldComponentProps>
> = {
  text:              TextField,
  textarea:          TextAreaField,
  "rich-text":       RichTextField,
  number:            NumberField,
  currency:          NumberField,           // variant handled via props
  percentage:        NumberField,
  date:              DateField,
  "date-range":      DateRangeField,
  select:            SelectField,
  "multi-select":    MultiSelectField,
  "radio-group":     RadioGroupField,
  checkbox:          CheckboxField,
  "checkbox-group": CheckboxGroupField,
  switch:            SwitchField,
  "file-upload":     FileUploadField,
  "file-upload-multi": FileUploadField,     // variant handled via props
  "user-picker":     UserPickerField,
  reference:         ReferenceField,
  rating:            RatingField,
  severity:          SeverityField,
  section:           SectionHeader,
  divider:           Divider,
  custom:            CustomFieldProxy,
};

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5 — THE ENGINE ITSELF
// FILE: components/patterns/dynamic-form/dynamic-form-engine.tsx
// ═════════════════════════════════════════════════════════════════════════════

import { useMemo, useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations, useLocale } from "next-intl";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { TRPCClientError } from "@trpc/client";
import { useDraftStore } from "@/stores/draft-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface DynamicFormEngineProps {
  /** Field definitions from the engagement's Standard Pack. */
  fields: FieldDefinition[];
  /** Existing values when editing; undefined when creating. */
  defaultValues?: FormValues;
  /** Draft identifier — enables autosave. Falsy = no autosave. */
  draftKey?: string;
  /** Server-side submit. Should throw TRPCClientError on validation failures. */
  onSubmit: (values: FormValues) => Promise<void>;
  /** Called on cancel (e.g., router back). */
  onCancel?: () => void;
  /** Render entire form as read-only. */
  readOnly?: boolean;
  /** Label for the primary action. Defaults to "Save". */
  submitLabel?: string;
}

export function DynamicFormEngine({
  fields,
  defaultValues,
  draftKey,
  onSubmit,
  onCancel,
  readOnly,
  submitLabel,
}: DynamicFormEngineProps) {
  const locale = useLocale();
  const t = useTranslations("dynamicForm");
  const draftStore = useDraftStore();

  // Sort fields by layout.order, then by declaration order.
  const orderedFields = useMemo(
    () =>
      [...fields].sort(
        (a, b) => (a.layout?.order ?? Number.MAX_SAFE_INTEGER) - (b.layout?.order ?? Number.MAX_SAFE_INTEGER)
      ),
    [fields]
  );

  // Build Zod schema dynamically from field definitions.
  const schema = useMemo(() => buildDynamicSchema(orderedFields), [orderedFields]);

  // Seed default values — draft > provided defaults > field.defaultValue > undefined.
  const seedValues = useMemo(() => {
    const draft = draftKey ? draftStore.get(draftKey) : undefined;
    const seed: FormValues = {};
    for (const f of orderedFields) {
      if (f.type === "section" || f.type === "divider") continue;
      seed[f.code] =
        draft?.[f.code] ??
        defaultValues?.[f.code] ??
        (f.defaultValue as unknown);
    }
    return seed;
  }, [orderedFields, defaultValues, draftKey, draftStore]);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: seedValues,
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  // Autosave draft on value change (debounced).
  const watchedValues = form.watch();
  const autosave = useDebouncedCallback((values: FormValues) => {
    if (!draftKey) return;
    draftStore.save(draftKey, values);
  }, 2000);
  useEffect(() => {
    if (draftKey && form.formState.isDirty) autosave(watchedValues);
  }, [watchedValues, draftKey, form.formState.isDirty, autosave]);

  // Compute visible fields (evaluate conditionals on every render — cheap).
  const visibleFields = orderedFields.filter((f) => {
    if (!f.conditional || f.conditional.mode !== "hide") return true;
    return evaluateConditional(f.conditional, watchedValues);
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      if (draftKey) draftStore.clear(draftKey);
      toast.success(t("saved"));
    } catch (err) {
      // Map server-side field errors back to RHF.
      if (err instanceof TRPCClientError) {
        const issues = (err.data as { fieldErrors?: Record<string, string> })?.fieldErrors;
        if (issues) {
          for (const [path, message] of Object.entries(issues)) {
            form.setError(path as FieldPath<FormValues>, { message });
          }
          toast.error(t("validationError"));
          return;
        }
      }
      toast.error(t("saveFailed"));
    }
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <div className="grid grid-cols-12 gap-x-6 gap-y-5">
          {visibleFields.map((field) => {
            if (field.type === "section") {
              return (
                <div key={field.code} className="col-span-12">
                  <SectionHeader
                    field={field}
                    control={form.control}
                    name={field.code}
                    locale={locale}
                  />
                </div>
              );
            }
            if (field.type === "divider") {
              return <div key={field.code} className="col-span-12"><Divider {...({ field, control: form.control, name: field.code, locale } as FieldComponentProps)} /></div>;
            }

            const Component = FieldRegistry[field.type];
            const cols = field.layout?.cols ?? "full";
            const colSpan =
              cols === 1 ? "col-span-12 md:col-span-4"
              : cols === 2 ? "col-span-12 md:col-span-6"
              : cols === 3 ? "col-span-12 md:col-span-4 lg:col-span-3"
              : "col-span-12";

            const isReadOnly = readOnly || field.readOnly;

            return (
              <div key={field.code} className={cn(colSpan)}>
                <Component
                  field={field}
                  control={form.control}
                  name={field.code}
                  readOnly={isReadOnly}
                  locale={locale}
                />
              </div>
            );
          })}
        </div>

        {!readOnly && (
          <div className="bg-background sticky bottom-0 -mx-6 flex items-center justify-end gap-2 border-t px-6 py-4">
            {draftKey && form.formState.isDirty && (
              <span className="text-muted-foreground text-xs">
                {t("autosaved")}
              </span>
            )}
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={form.formState.isSubmitting}>
                {t("cancel")}
              </Button>
            )}
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t("saving") : (submitLabel ?? t("save"))}
            </Button>
          </div>
        )}
      </form>
    </FormProvider>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6 — CONSUMER: THE FINDING FORM
// FILE: components/app/finding-form.tsx
// ═════════════════════════════════════════════════════════════════════════════
//
// This is what application code looks like when the engine exists. Note:
//   - No hardcoded finding fields.
//   - Same file handles GAGAS, IIA, SOX, ISO — the engagement's pack decides.
//   - If a tenant authors a custom pack, this form renders it automatically.

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";

interface FindingFormProps {
  engagementId: string;
  /** When editing. Undefined when creating. */
  findingId?: string;
}

export function FindingForm({ engagementId, findingId }: FindingFormProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  // 1. Load the engagement's Standard Pack to learn its field definitions.
  const packQuery = trpc.engagement.getFindingFields.useQuery({ engagementId });

  // 2. Load existing values if editing.
  const findingQuery = trpc.finding.getById.useQuery(
    { id: findingId! },
    { enabled: Boolean(findingId) }
  );

  // 3. Mutation — create or update.
  const save = trpc.finding.upsert.useMutation({
    onSuccess: (data) => {
      utils.finding.list.invalidate({ engagementId });
      utils.finding.getById.invalidate({ id: data.id });
      router.push(`/engagements/${engagementId}/findings/${data.id}`);
    },
  });

  if (packQuery.isLoading || findingQuery.isLoading) {
    return <FindingFormSkeleton />;
  }
  if (packQuery.isError) {
    return <ErrorState error={packQuery.error} onRetry={() => packQuery.refetch()} />;
  }

  const fields = packQuery.data!.findingElements;        // ← the pack defines these
  const defaults = findingQuery.data?.elementValues;
  const readOnly = findingQuery.data?.status === "ISSUED" || findingQuery.data?.status === "CLOSED";

  return (
    <DynamicFormEngine
      fields={fields}
      defaultValues={defaults}
      draftKey={findingId ? `finding:${findingId}` : `finding:new:${engagementId}`}
      readOnly={readOnly}
      onSubmit={async (values) => {
        await save.mutateAsync({
          id: findingId,
          engagementId,
          elementValues: values,
        });
      }}
      onCancel={() => router.back()}
    />
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 7 — EXAMPLE PACK INPUT (data, not code)
// FILE: packages/standard-packs/gagas-2024/finding-elements.json
// ═════════════════════════════════════════════════════════════════════════════
//
// Copied here verbatim to show what drives the engine. Actual pack lives in
// packages/standard-packs/ and is validated against standard-pack-schema.json.

export const GAGAS_2024_FINDING_ELEMENTS_EXAMPLE: FieldDefinition[] = [
  {
    code: "severity",
    label: { "en-US": "Severity" },
    type: "severity",
    required: true,
    layout: { cols: 1, order: 10 },
  },
  {
    code: "summary",
    label: { "en-US": "Summary" },
    placeholder: { "en-US": "One-line summary of the finding" },
    type: "text",
    required: true,
    validation: { minLength: 10, maxLength: 240 },
    layout: { cols: "full", order: 20 },
  },
  {
    code: "_gagas_elements",
    label: { "en-US": "GAGAS §6.39 Elements" },
    type: "section",
    layout: { order: 30 },
  },
  {
    code: "criteria",
    label: { "en-US": "Criteria" },
    helpText: { "en-US": "The required or desired state, benchmark, or reference against which the condition is compared." },
    type: "rich-text",
    required: true,
    validation: { maxLength: 50000 },
    layout: { cols: "full", order: 40, sectionCode: "_gagas_elements" },
  },
  {
    code: "condition",
    label: { "en-US": "Condition" },
    helpText: { "en-US": "The situation that exists — what we observed or found." },
    type: "rich-text",
    required: true,
    validation: { maxLength: 50000 },
    layout: { cols: "full", order: 50, sectionCode: "_gagas_elements" },
  },
  {
    code: "cause",
    label: { "en-US": "Cause" },
    helpText: { "en-US": "Why the condition occurred — the reason for the difference between the condition and criteria." },
    type: "rich-text",
    required: true,
    validation: { maxLength: 50000 },
    layout: { cols: "full", order: 60, sectionCode: "_gagas_elements" },
  },
  {
    code: "effect",
    label: { "en-US": "Effect" },
    helpText: { "en-US": "The outcome or consequence of the condition — actual or potential impact." },
    type: "rich-text",
    required: true,
    validation: { maxLength: 50000 },
    layout: { cols: "full", order: 70, sectionCode: "_gagas_elements" },
  },
  {
    code: "hasRegulatoryImpact",
    label: { "en-US": "Has regulatory impact?" },
    type: "switch",
    required: false,
    layout: { cols: 1, order: 80 },
  },
  {
    code: "regulatoryImpactDetails",
    label: { "en-US": "Regulatory impact details" },
    type: "rich-text",
    conditional: { field: "hasRegulatoryImpact", op: "eq", value: true, mode: "require" },
    layout: { cols: "full", order: 85 },
  },
  {
    code: "relatedControls",
    label: { "en-US": "Related controls" },
    type: "reference",
    referenceTarget: "control",
    layout: { cols: 2, order: 90 },
  },
];

// Same engine, different pack, different form — IIA GIAS 2024 adds `recommendation` element:
export const IIA_GIAS_2024_FINDING_ELEMENTS_EXAMPLE: FieldDefinition[] = [
  ...GAGAS_2024_FINDING_ELEMENTS_EXAMPLE.filter((f) => f.code !== "_gagas_elements"),
  {
    code: "recommendation",
    label: { "en-US": "Recommendation" },
    helpText: { "en-US": "Per IIA GIAS Standard 15.1 — a specific action to address the cause." },
    type: "rich-text",
    required: true,
    validation: { maxLength: 50000 },
    layout: { cols: "full", order: 75 },
  },
];

// ═════════════════════════════════════════════════════════════════════════════
// That's the entire story:
//   - 1 engine (~150 lines of real code)
//   - N packs (JSON data, not code)
//   - Every standard's finding form rendered correctly, validated correctly,
//     persisted to the same `elementValues` JSONB column on the Finding entity.
// ═════════════════════════════════════════════════════════════════════════════
