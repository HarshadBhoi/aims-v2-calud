"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import {
  Alert,
  Button,
  Card,
  Input,
  Label,
  Textarea,
} from "@/src/components/ui";
import { trpc } from "@/src/lib/trpc";

type Decision = "APPROVED" | "RETURNED" | "REJECTED";

export default function ReviewDetailPage() {
  const router = useRouter();
  const params = useParams<{ findingId: string }>();
  const utils = trpc.useUtils();

  const findingQuery = trpc.finding.get.useQuery({ id: params.findingId });
  const resolvedQuery = trpc.pack.resolve.useQuery(
    { engagementId: findingQuery.data?.engagementId ?? "" },
    { enabled: Boolean(findingQuery.data?.engagementId) },
  );

  const decide = trpc.finding.decide.useMutation();
  const mfaChallenge = trpc.auth.mfaChallenge.useMutation();

  const [comment, setComment] = useState("");
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [totp, setTotp] = useState("");
  const [stepUpError, setStepUpError] = useState<string | null>(null);

  function isStepUpError(message: string): boolean {
    return message.toLowerCase().includes("step-up");
  }

  async function runDecide(decision: Decision) {
    if (!findingQuery.data) return;
    setPendingDecision(decision);
    try {
      await decide.mutateAsync({
        id: params.findingId,
        expectedVersion: findingQuery.data.version,
        decision,
        ...(comment ? { comment } : {}),
      });
      await utils.finding.listPending.invalidate();
      await utils.finding.get.invalidate({ id: params.findingId });
      router.replace("/dashboard/approvals");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Decision failed.";
      if (isStepUpError(message)) {
        // Keep `pendingDecision` set so the step-up flow can replay it
        // automatically after MFA verification.
        setStepUpOpen(true);
      } else {
        setPendingDecision(null);
      }
    }
  }

  async function runStepUp() {
    setStepUpError(null);
    if (!/^\d{6}$/.test(totp)) {
      setStepUpError("Enter the 6-digit TOTP code.");
      return;
    }
    try {
      await mfaChallenge.mutateAsync({ code: totp });
      setStepUpOpen(false);
      setTotp("");
      const replay = pendingDecision;
      if (replay) {
        await runDecide(replay);
      }
    } catch (err) {
      setStepUpError(err instanceof Error ? err.message : "MFA challenge failed.");
    }
  }

  if (findingQuery.isLoading) {
    return <p className="text-sm text-[var(--color-muted)]">Loading…</p>;
  }
  if (findingQuery.error ?? !findingQuery.data) {
    return <Alert tone="error">{findingQuery.error?.message ?? "Finding not found."}</Alert>;
  }

  const f = findingQuery.data;
  const requirements = resolvedQuery.data?.findingElements ?? [];
  const reviewable = f.status === "IN_REVIEW";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/approvals"
          className="text-xs text-[var(--color-muted)] hover:underline"
        >
          ← Review queue
        </Link>
        <h1 className="text-2xl font-semibold">{f.title}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          {f.findingNumber} · {f.classification} · {f.status}
        </p>
      </div>

      {!reviewable ? (
        <Alert tone="info">
          This finding is no longer in review (current status:{" "}
          <strong>{f.status}</strong>).
        </Alert>
      ) : null}

      <div className="space-y-4">
        {requirements.map((req) => (
          <Card key={req.code}>
            <Label htmlFor={`element-${req.code}`}>{req.name}</Label>
            <Textarea
              id={`element-${req.code}`}
              value={f.elementValues[req.code] ?? ""}
              readOnly
              rows={6}
            />
          </Card>
        ))}
      </div>

      {reviewable ? (
        <Card>
          <Label htmlFor="comment">Reviewer comment (optional)</Label>
          <Textarea
            id="comment"
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
            }}
            placeholder="Notes for the author or audit trail…"
            rows={3}
          />

          <div className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void runDecide("REJECTED");
              }}
              disabled={decide.isPending}
            >
              {pendingDecision === "REJECTED" && decide.isPending ? "Rejecting…" : "Reject"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void runDecide("RETURNED");
              }}
              disabled={decide.isPending}
            >
              {pendingDecision === "RETURNED" && decide.isPending ? "Returning…" : "Return"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                void runDecide("APPROVED");
              }}
              disabled={decide.isPending}
            >
              {pendingDecision === "APPROVED" && decide.isPending ? "Approving…" : "Approve"}
            </Button>
          </div>

          {decide.error && !stepUpOpen ? (
            <Alert tone="error">{decide.error.message}</Alert>
          ) : null}
        </Card>
      ) : null}

      {stepUpOpen ? (
        <Card>
          <h2 className="mb-2 text-lg font-semibold">Verify your identity</h2>
          <p className="mb-4 text-sm text-[var(--color-muted)]">
            Approving a finding requires a fresh MFA check. Enter the 6-digit
            code from your authenticator app — your decision will replay
            automatically.
          </p>
          <div className="space-y-2">
            <Label htmlFor="totp">6-digit TOTP code</Label>
            <div className="flex gap-2">
              <Input
                id="totp"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={totp}
                onChange={(e) => {
                  setTotp(e.target.value.replace(/\D/g, ""));
                }}
                placeholder="123456"
                className="w-32"
              />
              <Button
                type="button"
                onClick={() => {
                  void runStepUp();
                }}
                disabled={mfaChallenge.isPending}
              >
                {mfaChallenge.isPending ? "Verifying…" : "Verify"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStepUpOpen(false);
                  setTotp("");
                  setStepUpError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
          {stepUpError ? <Alert tone="error">{stepUpError}</Alert> : null}
        </Card>
      ) : null}
    </div>
  );
}
