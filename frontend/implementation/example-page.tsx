/**
 * REFERENCE IMPLEMENTATION — Engagement List Page
 *
 * This file is a self-contained example that exercises nearly every convention
 * documented in the companion READMEs:
 *   - Server Component data fetching via tRPC server caller
 *   - HydrationBoundary for client cache warm-up
 *   - Client child for interactivity (filters, pagination)
 *   - URL-synced filter state (nuqs)
 *   - DataTable pattern
 *   - Permission-aware action buttons
 *   - i18n via next-intl
 *   - Suspense + streaming
 *   - Loading skeleton + error boundary
 *
 * When building a new list page, copy this file and replace the entity.
 * Do not invent new patterns without updating the frontend/ docs first.
 *
 * File paths shown as comments are where each piece lives in the real tree.
 */

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/(app)/engagements/page.tsx
// ═════════════════════════════════════════════════════════════════════════════

import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getServerSession } from "@/lib/auth/session";
import { createServerHelpers } from "@/lib/trpc/server";
import { PageHeader } from "@/components/patterns/page-header";
import { PageLayout } from "@/components/patterns/page-layout";
import { StatCards } from "@/components/patterns/stat-cards";
import { EngagementListClient } from "./engagement-list-client";
import { EngagementListSkeleton } from "./engagement-list-skeleton";
import { NewEngagementButton } from "./new-engagement-button";

// Route segment config — Next.js App Router.
export const dynamic = "force-dynamic";           // always fresh; auth-gated
export const revalidate = 0;

export async function generateMetadata() {
  const t = await getTranslations("engagement.list");
  return {
    title: t("title"),
    description: t("metaDescription"),
  };
}

/**
 * Server Component — renders before any JS hydrates.
 *
 * Responsibilities:
 *   1. Enforce auth (redirect handled in (app)/layout.tsx, but we verify)
 *   2. Prefetch data into React Query cache (so client hydrates with data)
 *   3. Render skeleton of page; stream data-heavy sections via Suspense
 */
export default async function EngagementListPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    severity?: string;
    q?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const { user, tenantId } = await getServerSession();     // throws + redirects if no session
  const t = await getTranslations("engagement.list");

  // Build input for the prefetch — mirrors what the client component will request.
  const listInput = {
    status: sp.status?.split(","),
    q: sp.q ?? "",
    page: Number(sp.page) || 1,
    limit: 25,
  };

  // Server-side helpers with the current user's context.
  // This runs the tRPC procedure directly (no HTTP).
  const helpers = await createServerHelpers({ userId: user.id, tenantId });

  // Prefetch in parallel — both go into the React Query cache to hydrate client.
  await Promise.all([
    helpers.engagement.list.prefetch(listInput),
    helpers.engagement.stats.prefetch(),
  ]);

  const statsData = helpers.queryClient.getQueryData<EngagementStats>(
    helpers.engagement.stats.getQueryKey()
  );

  return (
    <PageLayout
      header={
        <PageHeader
          breadcrumb={[{ label: t("breadcrumb.home"), href: "/" }]}
          title={t("title")}
          description={t("description")}
          actions={<NewEngagementButton />}
        />
      }
      stats={statsData ? <StatCards stats={buildStatTiles(statsData, t)} /> : null}
    >
      <HydrationBoundary state={dehydrate(helpers.queryClient)}>
        <Suspense fallback={<EngagementListSkeleton />}>
          {/* Client child — handles filters, sorting, pagination, table. */}
          <EngagementListClient />
        </Suspense>
      </HydrationBoundary>
    </PageLayout>
  );
}

// Helper — pure, stays in server file since it's used server-side.
function buildStatTiles(stats: EngagementStats, t: (key: string) => string) {
  return [
    { label: t("stats.total"),       value: stats.total,       trend: stats.totalTrend },
    { label: t("stats.inProgress"),  value: stats.inProgress,  trend: stats.inProgressTrend },
    { label: t("stats.overdue"),     value: stats.overdue,     trend: stats.overdueTrend, variant: "warning" as const },
    { label: t("stats.issuedYTD"),   value: stats.issuedYTD,   trend: stats.issuedTrend },
  ];
}

type EngagementStats = {
  total: number;       totalTrend: number;
  inProgress: number;  inProgressTrend: number;
  overdue: number;     overdueTrend: number;
  issuedYTD: number;   issuedTrend: number;
};

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/(app)/engagements/engagement-list-client.tsx
// ═════════════════════════════════════════════════════════════════════════════
// (Separate file in real tree — shown here for completeness.)

("use client");

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  useQueryStates,
} from "nuqs";
import { keepPreviousData } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc/client";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar } from "@/components/patterns/filter-bar";
import { StatusBadge } from "@/components/patterns/status-badge";
import { SeverityBadge } from "@/components/patterns/severity-badge";
import { UserBadge } from "@/components/patterns/user-badge";
import { RelativeTime } from "@/components/patterns/relative-time";
import { EmptyState } from "@/components/patterns/empty-state";
import { ErrorState } from "@/components/patterns/error-state";
import { RowActionsMenu } from "@/components/patterns/row-actions-menu";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { ColumnDef } from "@tanstack/react-table";
import type { EngagementListItem } from "@validation/engagement";

export function EngagementListClient() {
  const t = useTranslations("engagement.list");

  // URL-synced filter state.
  const [filters, setFilters] = useQueryStates({
    status: parseAsArrayOf(parseAsString).withDefault([]),
    severity: parseAsArrayOf(parseAsString).withDefault([]),
    q: parseAsString.withDefault(""),
    page: parseAsInteger.withDefault(1),
    sort: parseAsString.withDefault("createdAt:desc"),
  });

  // Debounce search for smooth typing UX.
  const debouncedQ = useDebouncedValue(filters.q, 300);

  const query = trpc.engagement.list.useQuery(
    {
      status: filters.status,
      severity: filters.severity,
      q: debouncedQ,
      page: filters.page,
      sort: filters.sort,
      limit: 25,
    },
    {
      placeholderData: keepPreviousData,   // no loading flash between filter changes
    }
  );

  const columns = buildColumns(t);

  if (query.isError) {
    return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  }

  const items = query.data?.items ?? [];
  const isFiltered =
    filters.status.length > 0 || filters.severity.length > 0 || filters.q !== "";

  return (
    <div className="space-y-4">
      <FilterBar
        searchValue={filters.q}
        onSearchChange={(q) => setFilters({ q, page: 1 })}
        filters={[
          {
            id: "status",
            label: t("filters.status"),
            options: statusOptions(t),
            value: filters.status,
            onChange: (v) => setFilters({ status: v, page: 1 }),
          },
          {
            id: "severity",
            label: t("filters.severity"),
            options: severityOptions(t),
            value: filters.severity,
            onChange: (v) => setFilters({ severity: v, page: 1 }),
          },
        ]}
        onClearAll={() => setFilters({ status: [], severity: [], q: "", page: 1 })}
      />

      {items.length === 0 && !query.isLoading ? (
        isFiltered ? (
          <EmptyState
            title={t("empty.filtered.title")}
            description={t("empty.filtered.description")}
            action={{
              label: t("empty.filtered.clearFilters"),
              onClick: () => setFilters({ status: [], severity: [], q: "", page: 1 }),
            }}
          />
        ) : (
          <EmptyState
            title={t("empty.first.title")}
            description={t("empty.first.description")}
            action={{ label: t("empty.first.action"), href: "/engagements/new" }}
          />
        )
      ) : (
        <DataTable
          columns={columns}
          data={items}
          loading={query.isLoading || query.isFetching}
          pagination={{
            page: filters.page,
            pageSize: 25,
            total: query.data?.totalCount ?? 0,
            onPageChange: (page) => setFilters({ page }),
          }}
          sorting={{
            sort: filters.sort,
            onSortChange: (sort) => setFilters({ sort, page: 1 }),
          }}
        />
      )}
    </div>
  );
}

function buildColumns(
  t: (key: string) => string
): ColumnDef<EngagementListItem>[] {
  return [
    {
      accessorKey: "title",
      header: t("columns.title"),
      cell: ({ row }) => (
        <Link
          href={`/engagements/${row.original.id}`}
          className="font-medium hover:underline focus-visible:underline"
          prefetch  // Next.js prefetches route + data on hover.
        >
          {row.original.title}
        </Link>
      ),
      size: 400,
      enableSorting: true,
    },
    {
      accessorKey: "type",
      header: t("columns.type"),
      cell: ({ row }) => <span className="capitalize">{row.original.type.toLowerCase()}</span>,
      size: 140,
    },
    {
      accessorKey: "standardPack",
      header: t("columns.pack"),
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {row.original.standardPack.label}
        </span>
      ),
      size: 140,
    },
    {
      accessorKey: "status",
      header: t("columns.status"),
      cell: ({ row }) => <StatusBadge value={row.original.status} />,
      size: 120,
    },
    {
      accessorKey: "severity",
      header: t("columns.severity"),
      cell: ({ row }) =>
        row.original.severity ? <SeverityBadge value={row.original.severity} /> : null,
      size: 120,
    },
    {
      accessorKey: "leadAuditor",
      header: t("columns.leadAuditor"),
      cell: ({ row }) =>
        row.original.leadAuditor ? <UserBadge user={row.original.leadAuditor} /> : null,
      size: 200,
    },
    {
      accessorKey: "createdAt",
      header: t("columns.created"),
      cell: ({ row }) => <RelativeTime date={row.original.createdAt} />,
      size: 120,
      enableSorting: true,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <RowActionsMenu
          row={row.original}
          actions={[
            {
              label: "Open",
              href: `/engagements/${row.original.id}`,
              when: true,
            },
            {
              label: "Edit",
              href: `/engagements/${row.original.id}/edit`,
              when: row.original._can.edit,
            },
            {
              label: "Duplicate",
              onClick: () => duplicateEngagement(row.original.id),
              when: row.original._can.edit,
            },
            {
              label: "Archive",
              onClick: () => archiveEngagement(row.original.id),
              when: row.original._can.delete,
              variant: "destructive",
            },
          ]}
        />
      ),
      size: 64,
      enableSorting: false,
    },
  ];
}

// Helper stubs — real implementations call tRPC mutations.
async function duplicateEngagement(_id: string) {
  /* utils.engagement.duplicate.mutate({ id }) */
}
async function archiveEngagement(_id: string) {
  /* ConfirmDialog then utils.engagement.archive.mutate({ id }) */
}

function statusOptions(t: (k: string) => string) {
  return [
    { value: "DRAFT",       label: t("status.draft") },
    { value: "IN_PROGRESS", label: t("status.inProgress") },
    { value: "IN_REVIEW",   label: t("status.inReview") },
    { value: "ISSUED",      label: t("status.issued") },
    { value: "CLOSED",      label: t("status.closed") },
  ];
}
function severityOptions(t: (k: string) => string) {
  return [
    { value: "CRITICAL", label: t("severity.critical") },
    { value: "HIGH",     label: t("severity.high") },
    { value: "MEDIUM",   label: t("severity.medium") },
    { value: "LOW",      label: t("severity.low") },
  ];
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/(app)/engagements/loading.tsx
// ═════════════════════════════════════════════════════════════════════════════

export function Loading() {
  return <EngagementListSkeleton />;
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/(app)/engagements/error.tsx
// ═════════════════════════════════════════════════════════════════════════════

("use client");

export function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Report to Sentry on mount.
  if (typeof window !== "undefined" && window.__sentry) {
    window.__sentry.captureException(error);
  }

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-2xl font-semibold">Something went wrong</h2>
      <p className="text-muted-foreground max-w-md">
        We couldn't load engagements. This has been reported — try again, or contact support if it
        persists.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium"
        >
          Try again
        </button>
        <Link
          href="/"
          className="border-input bg-background hover:bg-accent inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// FILE: app/(app)/engagements/engagement-list-skeleton.tsx
// ═════════════════════════════════════════════════════════════════════════════

import { Skeleton } from "@/components/ui/skeleton";

export function EngagementListSkeleton() {
  // Match the shape of the real table so hydration doesn't cause layout shift.
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      {/* FilterBar skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      {/* Table skeleton */}
      <div className="space-y-2 rounded-md border">
        <Skeleton className="h-10 w-full" /> {/* header */}
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
