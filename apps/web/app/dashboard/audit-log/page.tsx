"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  CardDescription,
  CardTitle,
} from "@/src/components/ui";
import { trpc } from "@/src/lib/trpc";

export default function AuditLogPage() {
  const search = useSearchParams();
  const entityType = search.get("entityType") ?? undefined;
  const entityId = search.get("entityId") ?? undefined;

  const [cursor, setCursor] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);

  const list = trpc.auditLog.list.useQuery({
    limit: 50,
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    ...(cursor ? { cursor } : {}),
  });

  const verify = trpc.auditLog.verifyChain.useQuery(undefined, {
    enabled: false,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit log</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Hash-chained, append-only record of every mutation. Tenant-scoped
            view; the chain itself spans the whole platform.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            void verify.refetch();
          }}
          disabled={verify.isFetching}
        >
          {verify.isFetching ? "Verifying…" : "Verify chain"}
        </Button>
      </div>

      {entityType ?? entityId ? (
        <Alert tone="info">
          Filtered to{" "}
          {entityType ? (
            <code className="font-mono text-xs">{entityType}</code>
          ) : null}
          {entityType && entityId ? " · " : null}
          {entityId ? (
            <code className="font-mono text-xs">{entityId}</code>
          ) : null}
        </Alert>
      ) : null}

      {verify.data ? (
        <Alert tone={verify.data.ok ? "success" : "error"}>
          {verify.data.ok ? "✓ " : "✗ "}
          {verify.data.reason}
          {verify.data.brokenAt !== null
            ? ` (broken at chainPosition ${verify.data.brokenAt.toString()})`
            : null}
          {" — verified "}
          {verify.data.totalRows.toString()} row(s).
        </Alert>
      ) : null}
      {verify.error ? <Alert tone="error">{verify.error.message}</Alert> : null}

      <Card>
        <CardTitle>Entries</CardTitle>
        <CardDescription>
          Newest first. Each row carries the previous-hash + content-hash
          pointers that bind it into the chain.
        </CardDescription>

        {list.isLoading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading…</p>
        ) : list.error ? (
          <Alert tone="error">{list.error.message}</Alert>
        ) : !list.data || list.data.items.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No entries yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-black/5 text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--color-muted)]">
                  <th className="px-2 py-2 font-medium">#</th>
                  <th className="px-2 py-2 font-medium">When</th>
                  <th className="px-2 py-2 font-medium">Action</th>
                  <th className="px-2 py-2 font-medium">Entity</th>
                  <th className="px-2 py-2 font-medium">Content hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {list.data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-2 py-2 font-mono text-xs text-[var(--color-muted)]">
                      {entry.chainPosition.toString()}
                    </td>
                    <td className="px-2 py-2 text-xs">
                      {new Date(entry.loggedAt).toLocaleString()}
                    </td>
                    <td className="px-2 py-2 font-medium">{entry.action}</td>
                    <td className="px-2 py-2">
                      <span className="text-xs text-[var(--color-muted)]">
                        {entry.entityType}
                      </span>
                      {entry.entityId ? (
                        <span className="ml-1 font-mono text-xs">
                          {entry.entityId.slice(0, 12)}…
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">
                      {entry.contentHash.slice(0, 12)}…
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setCursor(pages[pages.length - 1] ?? null);
              setPages((prev) => prev.slice(0, -1));
            }}
            disabled={pages.length === 0}
          >
            ← Previous page
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (list.data?.nextCursor) {
                setPages((prev) => [...prev, cursor ?? ""]);
                setCursor(list.data.nextCursor);
              }
            }}
            disabled={!list.data?.nextCursor}
          >
            Next page →
          </Button>
        </div>
      </Card>
    </div>
  );
}
