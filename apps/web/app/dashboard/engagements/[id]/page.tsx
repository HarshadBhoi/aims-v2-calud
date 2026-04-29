"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { Button, Card, CardDescription, CardTitle } from "@/src/components/ui";
import { trpc } from "@/src/lib/trpc";

export default function EngagementDetailPage() {
  const params = useParams<{ id: string }>();
  const engagement = trpc.engagement.get.useQuery(
    { id: params.id },
    { enabled: Boolean(params.id) },
  );
  const findings = trpc.finding.list.useQuery(
    { engagementId: params.id },
    { enabled: Boolean(params.id) },
  );
  const reports = trpc.report.list.useQuery(
    { engagementId: params.id },
    { enabled: Boolean(params.id) },
  );

  if (engagement.isLoading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading…</p>;
  }

  if (engagement.error ?? !engagement.data) {
    return (
      <p className="text-sm text-red-600">
        {engagement.error?.message ?? "Engagement not found."}
      </p>
    );
  }

  const e = engagement.data;

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{e.name}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {e.auditeeName} · {e.fiscalPeriod} · {e.status}
          </p>
        </div>
        <Link
          href={`/dashboard/audit-log?entityType=engagements&entityId=${params.id}`}
          className="text-xs text-[var(--color-muted)] hover:underline"
        >
          View audit log →
        </Link>
      </div>

      <Card>
        <CardTitle>Overview</CardTitle>
        <CardDescription>Core engagement metadata.</CardDescription>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-[var(--color-muted)]">Period</dt>
          <dd>
            {new Date(e.periodStart).toLocaleDateString()} →{" "}
            {new Date(e.periodEnd).toLocaleDateString()}
          </dd>
          <dt className="text-[var(--color-muted)]">Planned hours</dt>
          <dd>{e.plannedHours ?? "—"}</dd>
          <dt className="text-[var(--color-muted)]">Status</dt>
          <dd>{e.status}</dd>
          <dt className="text-[var(--color-muted)]">Pack strategy</dt>
          <dd>{e.packStrategyLocked ? "Locked" : "Unlocked"}</dd>
          <dt className="text-[var(--color-muted)]">Created</dt>
          <dd>{new Date(e.createdAt).toLocaleString()}</dd>
        </dl>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <CardTitle>Findings</CardTitle>
            <CardDescription>
              GAGAS §6.39 four-element findings under this engagement.
            </CardDescription>
          </div>
          <Link href={`/dashboard/engagements/${params.id}/findings/new`}>
            <Button>+ New finding</Button>
          </Link>
        </div>

        {findings.isLoading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading findings…</p>
        ) : findings.data && findings.data.length > 0 ? (
          <ul className="divide-y divide-black/5">
            {findings.data.map((f) => (
              <li key={f.id} className="py-3">
                <Link
                  href={`/dashboard/engagements/${params.id}/findings/${f.id}`}
                  className="flex items-center justify-between hover:underline"
                >
                  <div>
                    <p className="text-sm font-medium">{f.title}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {f.findingNumber} · {f.classification} · {f.elementsComplete.toString()}/4
                      complete
                    </p>
                  </div>
                  <span
                    className={
                      f.status === "APPROVED"
                        ? "text-xs font-medium text-green-700"
                        : f.status === "IN_REVIEW"
                          ? "text-xs font-medium text-amber-700"
                          : "text-xs font-medium text-[var(--color-muted)]"
                    }
                  >
                    {f.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            No findings yet. Click &ldquo;New finding&rdquo; to start the four-element form.
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <CardTitle>Reports</CardTitle>
            <CardDescription>
              Engagement reports composed from current findings + pack disclosures.
            </CardDescription>
          </div>
          <Link href={`/dashboard/engagements/${params.id}/reports/new`}>
            <Button>+ New report</Button>
          </Link>
        </div>

        {reports.isLoading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading reports…</p>
        ) : reports.data && reports.data.length > 0 ? (
          <ul className="divide-y divide-black/5">
            {reports.data.map((r) => (
              <li key={r.id} className="py-3">
                <Link
                  href={`/dashboard/engagements/${params.id}/reports/${r.id}`}
                  className="flex items-center justify-between hover:underline"
                >
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {r.templateKey} · updated {new Date(r.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={
                      r.status === "PUBLISHED"
                        ? "text-xs font-medium text-green-700"
                        : r.status === "IN_REVIEW"
                          ? "text-xs font-medium text-amber-700"
                          : "text-xs font-medium text-[var(--color-muted)]"
                    }
                  >
                    {r.status}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            No reports yet. Click &ldquo;New report&rdquo; to generate one.
          </p>
        )}
      </Card>
    </div>
  );
}
