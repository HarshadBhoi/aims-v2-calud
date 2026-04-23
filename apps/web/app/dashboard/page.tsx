"use client";

import Link from "next/link";

import { Button, Card, CardDescription, CardTitle } from "@/src/components/ui";
import { trpc } from "@/src/lib/trpc";

export default function DashboardHome() {
  const me = trpc.auth.me.useQuery();
  const engagements = trpc.engagement.list.useQuery({ limit: 5 });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          Welcome back, {me.data?.name ?? "…"}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Your audit work at a glance.
        </p>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <CardTitle>Recent engagements</CardTitle>
            <CardDescription>The 5 most recent audits you can see.</CardDescription>
          </div>
          <Link href="/dashboard/engagements/new">
            <Button>+ New engagement</Button>
          </Link>
        </div>

        {engagements.isLoading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading…</p>
        ) : engagements.data?.items.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">
            No engagements yet. Create your first one to get started.
          </p>
        ) : (
          <ul className="divide-y divide-black/5">
            {engagements.data?.items.map((e) => (
              <li key={e.id} className="py-3">
                <div className="font-medium">{e.name}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {e.auditeeName} · {e.fiscalPeriod} · {e.status}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
