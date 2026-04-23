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

export default function NewEngagementPage() {
  const router = useRouter();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery();
  const create = trpc.engagement.create.useMutation({
    onSuccess: async (engagement) => {
      await utils.engagement.list.invalidate();
      router.replace(`/dashboard/engagements/${engagement.id}`);
    },
  });

  const [name, setName] = useState("");
  const [auditeeName, setAuditeeName] = useState("");
  const [fiscalPeriod, setFiscalPeriod] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [plannedHours, setPlannedHours] = useState("");

  return (
    <Card>
      <CardTitle>New engagement</CardTitle>
      <CardDescription>Create a new audit engagement.</CardDescription>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!me.data) return;
          create.mutate({
            name,
            auditeeName,
            fiscalPeriod,
            periodStart: new Date(periodStart),
            periodEnd: new Date(periodEnd),
            ...(plannedHours ? { plannedHours: Number.parseInt(plannedHours, 10) } : {}),
            leadUserId: me.data.id,
          });
        }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
            }}
            placeholder="FY26 Q1 Revenue Cycle Audit"
            required
          />
        </div>

        <div>
          <Label htmlFor="auditee">Auditee</Label>
          <Input
            id="auditee"
            value={auditeeName}
            onChange={(e) => {
              setAuditeeName(e.target.value);
            }}
            placeholder="NorthStar Finance"
            required
          />
        </div>

        <div>
          <Label htmlFor="period">Fiscal period</Label>
          <Input
            id="period"
            value={fiscalPeriod}
            onChange={(e) => {
              setFiscalPeriod(e.target.value);
            }}
            placeholder="FY26 Q1"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="start">Period start</Label>
            <Input
              id="start"
              type="date"
              value={periodStart}
              onChange={(e) => {
                setPeriodStart(e.target.value);
              }}
              required
            />
          </div>
          <div>
            <Label htmlFor="end">Period end</Label>
            <Input
              id="end"
              type="date"
              value={periodEnd}
              onChange={(e) => {
                setPeriodEnd(e.target.value);
              }}
              required
            />
          </div>
        </div>

        <div>
          <Label htmlFor="hours">Planned hours (optional)</Label>
          <Input
            id="hours"
            type="number"
            min="1"
            value={plannedHours}
            onChange={(e) => {
              setPlannedHours(e.target.value);
            }}
            placeholder="400"
          />
        </div>

        {create.error ? <Alert tone="error">{create.error.message}</Alert> : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              router.back();
            }}
          >
            Cancel
          </Button>

          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create engagement"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
