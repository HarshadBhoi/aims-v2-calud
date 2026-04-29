"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Alert, Button, Card, Label, Textarea } from "@/src/components/ui";
import { trpc } from "@/src/lib/trpc";

const AUTOSAVE_INTERVAL_MS = 10_000;

export default function FindingEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string; findingId: string }>();
  const utils = trpc.useUtils();

  const findingQuery = trpc.finding.get.useQuery(
    { id: params.findingId },
    { enabled: Boolean(params.findingId) },
  );
  const resolvedQuery = trpc.pack.resolve.useQuery(
    { engagementId: params.id },
    { enabled: Boolean(params.id) },
  );
  const updateElement = trpc.finding.updateElement.useMutation();
  const submitForReview = trpc.finding.submitForReview.useMutation({
    onSuccess: async () => {
      await utils.finding.get.invalidate({ id: params.findingId });
      await utils.finding.list.invalidate({ engagementId: params.id });
    },
  });

  // Local editor state — initialised from the server payload, then driven
  // by the user. `lastSaved` mirrors what the server has confirmed so we
  // can compute "dirty" without a separate flag.
  const [values, setValues] = useState<Record<string, string>>({});
  const [lastSaved, setLastSaved] = useState<Record<string, string>>({});
  const [version, setVersion] = useState<number>(0);
  const [elementsComplete, setElementsComplete] = useState<number>(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);

  const saving = useRef<boolean>(false);

  // Hydrate editor state from server response (once).
  useEffect(() => {
    if (hydrated || !findingQuery.data) return;
    const f = findingQuery.data;
    setValues(f.elementValues);
    setLastSaved(f.elementValues);
    setVersion(f.version);
    setElementsComplete(f.elementsComplete);
    setHydrated(true);
  }, [hydrated, findingQuery.data]);

  const dirtyCodes = useMemo(
    () =>
      Object.keys(values).filter(
        (code) => values[code] !== (lastSaved[code] ?? ""),
      ),
    [values, lastSaved],
  );

  // Stash a fresh `saveCycle` in a ref so the interval can call the latest
  // closure without resubscribing every render.
  const saveCycleRef = useRef<() => Promise<void>>(() => Promise.resolve());
  saveCycleRef.current = async () => {
    if (saving.current) return;
    if (dirtyCodes.length === 0) return;
    if (!hydrated) return;
    saving.current = true;
    setSaveError(null);
    try {
      let v = version;
      for (const code of dirtyCodes) {
        const captured = values[code] ?? "";
        const result = await updateElement.mutateAsync({
          id: params.findingId,
          elementCode: code,
          value: captured,
          expectedVersion: v,
        });
        v = result.version;
        setLastSaved((prev) => ({ ...prev, [code]: captured }));
        setElementsComplete(result.elementsComplete);
      }
      setVersion(v);
      setSavedAt(new Date());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Autosave failed.");
    } finally {
      saving.current = false;
    }
  };

  // Autosave loop — fires every 10s. Also flushes on unmount.
  useEffect(() => {
    const id = setInterval(() => {
      void saveCycleRef.current();
    }, AUTOSAVE_INTERVAL_MS);
    return () => {
      clearInterval(id);
      void saveCycleRef.current();
    };
  }, []);

  if (findingQuery.isLoading || resolvedQuery.isLoading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading…</p>;
  }
  if (findingQuery.error ?? !findingQuery.data) {
    return <Alert tone="error">{findingQuery.error?.message ?? "Finding not found."}</Alert>;
  }
  if (resolvedQuery.error ?? !resolvedQuery.data) {
    return (
      <Alert tone="error">
        {resolvedQuery.error?.message ?? "Could not resolve pack requirements."}
      </Alert>
    );
  }

  const finding = findingQuery.data;
  const requirements = resolvedQuery.data.findingElements;
  const requiredCount = requirements.filter((e) => e.required).length;
  const editable = finding.status === "DRAFT";
  const canSubmit =
    editable &&
    elementsComplete >= requiredCount &&
    dirtyCodes.length === 0 &&
    !saving.current &&
    !submitForReview.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <Link
            href={`/dashboard/engagements/${params.id}`}
            className="text-xs text-[var(--color-muted)] hover:underline"
          >
            ← Engagement
          </Link>
          <h1 className="text-2xl font-semibold">{finding.title}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {finding.findingNumber} · {finding.classification} · {finding.status}
          </p>
        </div>
        <SaveStatus
          saving={saving.current || updateElement.isPending}
          dirty={dirtyCodes.length > 0}
          savedAt={savedAt}
          editable={editable}
        />
      </div>

      <ProgressBar complete={elementsComplete} total={requiredCount} />

      {saveError ? <Alert tone="error">Autosave: {saveError}</Alert> : null}
      {!editable ? (
        <Alert tone="info">
          This finding is in <strong>{finding.status}</strong> — element edits are
          disabled until it returns to <strong>DRAFT</strong>.
        </Alert>
      ) : null}

      <div className="space-y-4">
        {requirements.map((req) => (
          <Card key={req.code}>
            <Label htmlFor={`element-${req.code}`}>
              {req.name}
              {req.required ? <span className="ml-1 text-red-600">*</span> : null}
              <span className="ml-2 text-xs font-normal text-[var(--color-muted)]">
                min {req.minLength.toString()} chars
              </span>
            </Label>
            <Textarea
              id={`element-${req.code}`}
              value={values[req.code] ?? ""}
              onChange={(e) => {
                setValues((prev) => ({ ...prev, [req.code]: e.target.value }));
              }}
              readOnly={!editable}
              placeholder={editable ? `Describe the ${req.name.toLowerCase()}…` : undefined}
              rows={6}
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              {(values[req.code] ?? "").length.toString()} / {req.minLength.toString()}{" "}
              {(values[req.code] ?? "").length >= req.minLength ? "✓" : ""}
            </p>
          </Card>
        ))}
      </div>

      {editable ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-[var(--color-muted)]">
            Autosave runs every {(AUTOSAVE_INTERVAL_MS / 1000).toString()} seconds.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void saveCycleRef.current();
              }}
              disabled={dirtyCodes.length === 0 || saving.current}
            >
              Save now
            </Button>
            <Button
              type="button"
              disabled={!canSubmit}
              onClick={() => {
                submitForReview.mutate({
                  id: params.findingId,
                  expectedVersion: version,
                });
              }}
            >
              {submitForReview.isPending ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              router.push(`/dashboard/engagements/${params.id}`);
            }}
          >
            Back to engagement
          </Button>
        </div>
      )}

      {submitForReview.error ? (
        <Alert tone="error">{submitForReview.error.message}</Alert>
      ) : null}
    </div>
  );
}

function ProgressBar({ complete, total }: { complete: number; total: number }) {
  const pct = total === 0 ? 0 : Math.min(100, (complete / total) * 100);
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-[var(--color-muted)]">
        <span>Required elements complete</span>
        <span>
          {complete.toString()} / {total.toString()}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full bg-[var(--color-primary)] transition-[width]"
          style={{ width: `${pct.toString()}%` }}
        />
      </div>
    </div>
  );
}

function SaveStatus({
  saving,
  dirty,
  savedAt,
  editable,
}: {
  saving: boolean;
  dirty: boolean;
  savedAt: Date | null;
  editable: boolean;
}) {
  if (!editable) return null;
  if (saving) {
    return <span className="text-xs text-[var(--color-muted)]">Saving…</span>;
  }
  if (dirty) {
    return <span className="text-xs text-amber-700">Unsaved changes</span>;
  }
  if (savedAt) {
    return (
      <span className="text-xs text-[var(--color-muted)]">
        Saved at {savedAt.toLocaleTimeString()}
      </span>
    );
  }
  return null;
}
