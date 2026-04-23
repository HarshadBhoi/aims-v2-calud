"use client";

import { useParams } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/src/components/ui";
import { trpc } from "@/src/lib/trpc";

export default function EngagementDetailPage() {
  const params = useParams<{ id: string }>();
  const engagement = trpc.engagement.get.useQuery(
    { id: params.id },
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
      <div>
        <h1 className="text-2xl font-semibold">{e.name}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {e.auditeeName} · {e.fiscalPeriod} · {e.status}
        </p>
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
    </div>
  );
}
