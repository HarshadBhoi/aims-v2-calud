export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">AIMS v2</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Multi-standard audit information management platform
      </p>

      <section className="mt-10 space-y-4 text-[var(--color-fg)]">
        <p>
          Scaffold is live — Next.js 15 + Tailwind v4 + workspace packages resolving.
        </p>
        <p>
          This placeholder home page confirms the web app boots. Real screens are built
          in Weeks 2–4 per{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 text-xs">
            VERTICAL-SLICE-PLAN.md §3.3
          </code>{" "}
          — sign-in, engagement dashboard, finding editor, report composer, audit log viewer.
        </p>
        <p className="pt-4 text-xs text-[var(--color-muted)]">
          Status: Slice A · Task 1.1 complete · Next: Task 1.2 Docker compose infra
        </p>
      </section>
    </main>
  );
}
