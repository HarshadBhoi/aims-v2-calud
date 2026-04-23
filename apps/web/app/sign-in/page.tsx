"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  CardDescription,
  CardTitle,
  Input,
  Label,
} from "@/src/components/ui";
import { trpc } from "@/src/lib/trpc";

export default function SignInPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const signIn = trpc.auth.signIn.useMutation({
    onSuccess: async () => {
      // Invalidate me() so the dashboard query refetches post-cookie.
      await utils.auth.me.invalidate();
      router.replace("/dashboard");
    },
  });

  const [tenantSlug, setTenantSlug] = useState("northstar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <Card className="w-full max-w-md">
        <CardTitle>Sign in to AIMS</CardTitle>
        <CardDescription>
          Multi-standard audit information management platform.
        </CardDescription>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            signIn.mutate({ tenantSlug, email, password });
          }}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="tenant">Tenant</Label>
            <Input
              id="tenant"
              value={tenantSlug}
              onChange={(e) => {
                setTenantSlug(e.target.value);
              }}
              placeholder="northstar"
              autoComplete="organization"
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
              }}
              autoComplete="current-password"
              required
            />
          </div>

          {signIn.error ? (
            <Alert tone="error">{signIn.error.message}</Alert>
          ) : null}

          <Button type="submit" disabled={signIn.isPending} className="w-full">
            {signIn.isPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-xs text-[var(--color-muted)]">
          Dev tip: seed users have NULL passwords. Set one via{" "}
          <code className="rounded bg-black/5 px-1">
            pnpm -F @aims/api set-password {"<slug> <email> <password>"}
          </code>
          .
        </p>
      </Card>
    </main>
  );
}
