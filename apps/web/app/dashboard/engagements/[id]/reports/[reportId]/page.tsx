"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { Alert, Button, Card, Input, Label, Textarea } from "@/src/components/ui";
import { trpc } from "@/src/lib/trpc";

const AUTOSAVE_INTERVAL_MS = 10_000;
const ATTESTATION_PHRASE = "I approve";

export default function ReportComposerPage() {
  const router = useRouter();
  const params = useParams<{ id: string; reportId: string }>();
  const utils = trpc.useUtils();

  const reportQuery = trpc.report.get.useQuery({ id: params.reportId }, {
    // While we're waiting for the worker to finish rendering the PDF
    // (status is PUBLISHED but `pdfRenderedAt` is still null), poll every
    // 3s so the alert flips from "queued" to "rendered" without manual
    // refresh.
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "PUBLISHED" && data.pdfRenderedAt === null) {
        return 3_000;
      }
      return false;
    },
  });
  const updateEditorial = trpc.report.updateEditorial.useMutation();
  const regenerate = trpc.report.regenerateDataSections.useMutation({
    onSuccess: async () => {
      await utils.report.get.invalidate({ id: params.reportId });
    },
  });
  const submit = trpc.report.submitForSignoff.useMutation({
    onSuccess: async () => {
      await utils.report.get.invalidate({ id: params.reportId });
    },
  });
  const sign = trpc.report.sign.useMutation();
  const mfaChallenge = trpc.auth.mfaChallenge.useMutation();

  // Editorial editing state — mirrors finding editor pattern.
  const [values, setValues] = useState<Record<string, string>>({});
  const [lastSaved, setLastSaved] = useState<Record<string, string>>({});
  const [version, setVersion] = useState<number>(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const saving = useRef<boolean>(false);

  // Sign ceremony state.
  const [signOpen, setSignOpen] = useState(false);
  const [attestation, setAttestation] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [totp, setTotp] = useState("");
  const [signError, setSignError] = useState<string | null>(null);

  // Download flow state.
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Hydrate editor state from server response, but only for editorial keys.
  useEffect(() => {
    if (hydrated || !reportQuery.data) return;
    const editorial: Record<string, string> = {};
    for (const [key, sec] of Object.entries(reportQuery.data.sections)) {
      if (sec.kind === "editorial") editorial[key] = sec.content;
    }
    setValues(editorial);
    setLastSaved(editorial);
    setVersion(reportQuery.data.version);
    setHydrated(true);
  }, [hydrated, reportQuery.data]);

  // Re-hydrate when regenerate / submit refetches and the server has moved
  // ahead of us. We only sync when the server is *ahead* — never when we're
  // ahead — because `updateEditorial` doesn't invalidate `report.get`, so a
  // stale (older) cached query would otherwise stomp our just-saved local
  // state and dead-loop the autosave against a 409.
  useEffect(() => {
    if (!hydrated || !reportQuery.data) return;
    if (reportQuery.data.version > version && !saving.current) {
      const editorial: Record<string, string> = {};
      for (const [key, sec] of Object.entries(reportQuery.data.sections)) {
        if (sec.kind === "editorial") editorial[key] = sec.content;
      }
      setLastSaved(editorial);
      setValues((prev) => {
        const merged = { ...editorial };
        for (const [k, v] of Object.entries(prev)) {
          if (v !== (editorial[k] ?? "")) merged[k] = v;
        }
        return merged;
      });
      setVersion(reportQuery.data.version);
    }
  }, [reportQuery.data, version, hydrated]);

  const dirtyKeys = useMemo(
    () =>
      Object.keys(values).filter((key) => values[key] !== (lastSaved[key] ?? "")),
    [values, lastSaved],
  );

  const saveCycleRef = useRef<() => Promise<void>>(() => Promise.resolve());
  saveCycleRef.current = async () => {
    if (saving.current) return;
    if (dirtyKeys.length === 0) return;
    if (!hydrated) return;
    saving.current = true;
    setSaveError(null);
    try {
      let v = version;
      for (const key of dirtyKeys) {
        const captured = values[key] ?? "";
        const result = await updateEditorial.mutateAsync({
          id: params.reportId,
          sectionKey: key,
          content: captured,
          expectedVersion: v,
        });
        v = result.version;
        setLastSaved((prev) => ({ ...prev, [key]: captured }));
      }
      setVersion(v);
      setSavedAt(new Date());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Autosave failed.");
    } finally {
      saving.current = false;
    }
  };

  useEffect(() => {
    const id = setInterval(() => {
      void saveCycleRef.current();
    }, AUTOSAVE_INTERVAL_MS);
    return () => {
      clearInterval(id);
      void saveCycleRef.current();
    };
  }, []);

  function isStepUpError(message: string): boolean {
    return message.toLowerCase().includes("step-up");
  }

  async function handleDownload() {
    setDownloadError(null);
    setDownloading(true);
    // Open the popup synchronously so the browser keeps the user-gesture
    // grant; the await below would otherwise drop it and the new tab
    // would land on about:blank with `noopener` stripping the URL.
    const popup = window.open("about:blank", "_blank");
    try {
      const result = await utils.report.downloadPdf.fetch({ id: params.reportId });
      if (popup) {
        popup.location.href = result.url;
      } else {
        // Popup blocked — fall back to same-tab navigation.
        window.location.href = result.url;
      }
    } catch (err) {
      popup?.close();
      setDownloadError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  function resetSignDialog() {
    setSignOpen(false);
    setAttestation("");
    setTotp("");
    setNeedsTotp(false);
    setSignError(null);
  }

  async function attemptSign() {
    setSignError(null);
    if (attestation !== ATTESTATION_PHRASE) {
      setSignError(`Please type "${ATTESTATION_PHRASE}" exactly to confirm.`);
      return;
    }
    if (needsTotp && !/^\d{6}$/.test(totp)) {
      setSignError("Enter the 6-digit TOTP code.");
      return;
    }
    try {
      if (needsTotp) {
        await mfaChallenge.mutateAsync({ code: totp });
      }
      await sign.mutateAsync({
        id: params.reportId,
        expectedVersion: version,
        attestation: ATTESTATION_PHRASE,
      });
      resetSignDialog();
      await utils.report.get.invalidate({ id: params.reportId });
      await utils.report.list.invalidate({ engagementId: params.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign failed.";
      if (!needsTotp && isStepUpError(message)) {
        setNeedsTotp(true);
        setSignError(null);
      } else {
        setSignError(message);
      }
    }
  }

  if (reportQuery.isLoading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading…</p>;
  }
  if (reportQuery.error ?? !reportQuery.data) {
    return <Alert tone="error">{reportQuery.error?.message ?? "Report not found."}</Alert>;
  }

  const r = reportQuery.data;
  const editable = r.status === "DRAFT";
  const inReview = r.status === "IN_REVIEW";
  const published = r.status === "PUBLISHED";
  const sectionEntries = Object.entries(r.sections);

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
          <h1 className="text-2xl font-semibold">{r.title}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {r.templateKey} · {r.versionNumber} · {r.status}
            {published && r.signedAt
              ? ` · signed ${new Date(r.signedAt).toLocaleString()}`
              : ""}
          </p>
        </div>
        <SaveStatus
          saving={saving.current || updateEditorial.isPending}
          dirty={dirtyKeys.length > 0}
          savedAt={savedAt}
          editable={editable}
        />
      </div>

      {published ? (
        <Alert tone="success">
          Report published. Content hash{" "}
          <code className="font-mono text-xs">{r.contentHash?.slice(0, 12)}…</code>{" "}
          anchored to the audit log.
          {r.pdfS3Key
            ? " PDF rendered."
            : " PDF render queued — refresh in a few seconds."}
        </Alert>
      ) : null}

      {inReview ? (
        <Alert tone="info">
          This report is in review. Sign &amp; publish below; editorial edits
          require returning to draft (slice A: no return path yet).
        </Alert>
      ) : null}

      {saveError ? <Alert tone="error">Autosave: {saveError}</Alert> : null}

      <div className="space-y-4">
        {sectionEntries.map(([key, section]) => (
          <Card key={key}>
            <div className="mb-2 flex items-baseline justify-between">
              <Label htmlFor={`section-${key}`}>{prettifyKey(key)}</Label>
              <span className="text-xs text-[var(--color-muted)]">
                {section.kind === "data" ? "Data-bound" : "Editorial"}
              </span>
            </div>
            {section.kind === "data" ? (
              <pre className="whitespace-pre-wrap rounded-md border border-black/10 bg-black/[0.02] px-3 py-2 font-sans text-sm leading-relaxed">
                {section.content || "(empty)"}
              </pre>
            ) : (
              <Textarea
                id={`section-${key}`}
                value={values[key] ?? ""}
                onChange={(e) => {
                  setValues((prev) => ({ ...prev, [key]: e.target.value }));
                }}
                readOnly={!editable}
                placeholder={editable ? "Author narrative…" : undefined}
                rows={5}
              />
            )}
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-muted)]">
          Autosave runs every {(AUTOSAVE_INTERVAL_MS / 1000).toString()} seconds for
          editorial sections.
        </p>
        <div className="flex gap-2">
          {editable ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  void saveCycleRef.current();
                }}
                disabled={dirtyKeys.length === 0 || saving.current}
              >
                Save now
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  regenerate.mutate({ id: params.reportId, expectedVersion: version });
                }}
                disabled={regenerate.isPending || dirtyKeys.length > 0 || saving.current}
              >
                {regenerate.isPending ? "Regenerating…" : "Regenerate data"}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  submit.mutate({ id: params.reportId, expectedVersion: version });
                }}
                disabled={submit.isPending || dirtyKeys.length > 0 || saving.current}
              >
                {submit.isPending ? "Submitting…" : "Submit for signoff"}
              </Button>
            </>
          ) : null}
          {inReview ? (
            <Button
              type="button"
              onClick={() => {
                setSignOpen(true);
              }}
            >
              Sign &amp; publish
            </Button>
          ) : null}
          {published ? (
            <>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  router.push(`/dashboard/engagements/${params.id}`);
                }}
              >
                Back to engagement
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void handleDownload();
                }}
                disabled={!r.pdfS3Key || downloading}
              >
                {downloading ? "Preparing…" : "Download PDF"}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {regenerate.error ? <Alert tone="error">{regenerate.error.message}</Alert> : null}
      {submit.error ? <Alert tone="error">{submit.error.message}</Alert> : null}
      {downloadError ? <Alert tone="error">Download: {downloadError}</Alert> : null}

      {signOpen ? (
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Sign &amp; publish</h2>
          <p className="mb-4 text-sm text-[var(--color-muted)]">
            Publishing freezes the report. The content hash is anchored to the
            audit log, and a PDF is queued for render. Type the attestation
            exactly to confirm.
          </p>

          <div className="space-y-3">
            <div>
              <Label htmlFor="attestation">
                Attestation phrase (type <code>{ATTESTATION_PHRASE}</code>)
              </Label>
              <Input
                id="attestation"
                value={attestation}
                onChange={(e) => {
                  setAttestation(e.target.value);
                }}
                placeholder={ATTESTATION_PHRASE}
              />
            </div>

            {needsTotp ? (
              <div>
                <Label htmlFor="sign-totp">6-digit TOTP code (MFA step-up)</Label>
                <Input
                  id="sign-totp"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={totp}
                  onChange={(e) => {
                    setTotp(e.target.value.replace(/\D/g, ""));
                  }}
                  placeholder="123456"
                  className="w-32"
                />
              </div>
            ) : null}

            {signError ? <Alert tone="error">{signError}</Alert> : null}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={resetSignDialog}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void attemptSign();
                }}
                disabled={sign.isPending || mfaChallenge.isPending}
              >
                {sign.isPending || mfaChallenge.isPending
                  ? "Signing…"
                  : needsTotp
                    ? "Verify & sign"
                    : "Sign & publish"}
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function prettifyKey(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
