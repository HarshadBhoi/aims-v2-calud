"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";

import { Button } from "@/src/components/ui";
import { trpc } from "@/src/lib/trpc";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const signOut = trpc.auth.signOut.useMutation({
    onSuccess: () => {
      router.replace("/sign-in");
    },
  });

  useEffect(() => {
    if (meQuery.isError) {
      router.replace("/sign-in");
    }
  }, [meQuery.isError, router]);

  if (meQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-[var(--color-muted)]">Loading…</p>
      </main>
    );
  }

  if (!meQuery.data) {
    return null; // redirecting
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-semibold">
              AIMS
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/dashboard" className="hover:underline">
                Dashboard
              </Link>
              <Link href="/dashboard/engagements" className="hover:underline">
                Engagements
              </Link>
              <Link href="/dashboard/approvals" className="hover:underline">
                Approvals
              </Link>
              <Link href="/dashboard/audit-log" className="hover:underline">
                Audit log
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-[var(--color-muted)]">
              {meQuery.data.name} ({meQuery.data.role})
            </span>
            <Button
              variant="ghost"
              onClick={() => {
                signOut.mutate();
              }}
              disabled={signOut.isPending}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
