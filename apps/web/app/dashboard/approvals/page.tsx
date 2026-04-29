"use client";

import Link from "next/link";

import { Card, CardDescription, CardTitle } from "@/src/components/ui";
import { trpc } from "@/src/lib/trpc";

export default function ApprovalsPage() {
  const pending = trpc.finding.listPending.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Review queue</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Findings awaiting reviewer decision.
        </p>
      </div>

      <Card>
        <CardTitle>Pending findings</CardTitle>
        <CardDescription>
          Open a finding to review the four elements and approve, return, or reject.
        </CardDescription>

        {pending.isLoading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading queue…</p>
        ) : pending.data && pending.data.length > 0 ? (
          <ul className="divide-y divide-black/5">
            {pending.data.map((f) => (
              <li key={f.id} className="py-3">
                <Link
                  href={`/dashboard/approvals/${f.id}`}
                  className="flex items-center justify-between hover:underline"
                >
                  <div>
                    <p className="text-sm font-medium">{f.title}</p>
                    <p className="text-xs text-[var(--color-muted)]">
                      {f.findingNumber} · {f.classification} · submitted{" "}
                      {new Date(f.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-amber-700">IN_REVIEW</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--color-muted)]">
            No findings pending review.
          </p>
        )}
      </Card>
    </div>
  );
}
