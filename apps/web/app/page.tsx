"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { trpc } from "@/src/lib/trpc";

/**
 * Root page: dispatches to /dashboard or /sign-in based on session state.
 */
export default function RootPage() {
  const router = useRouter();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (meQuery.isSuccess) {
      router.replace("/dashboard");
    } else if (meQuery.isError) {
      router.replace("/sign-in");
    }
  }, [meQuery.isSuccess, meQuery.isError, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-[var(--color-muted)]">Loading…</p>
    </main>
  );
}
