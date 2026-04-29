"use client";

import { useParams, useRouter } from "next/navigation";
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

const CLASSIFICATIONS = ["MINOR", "SIGNIFICANT", "MATERIAL", "CRITICAL"] as const;

export default function NewFindingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const utils = trpc.useUtils();

  const create = trpc.finding.create.useMutation({
    onSuccess: async (finding) => {
      await utils.finding.list.invalidate({ engagementId: params.id });
      router.replace(`/dashboard/engagements/${params.id}/findings/${finding.id}`);
    },
  });

  const [title, setTitle] = useState("");
  const [classification, setClassification] =
    useState<(typeof CLASSIFICATIONS)[number]>("SIGNIFICANT");

  return (
    <Card>
      <CardTitle>New finding</CardTitle>
      <CardDescription>
        Start a new finding under this engagement. You&rsquo;ll fill the four
        elements (Criteria, Condition, Cause, Effect) on the next screen.
      </CardDescription>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ engagementId: params.id, title, classification });
        }}
        className="space-y-4"
      >
        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
            }}
            placeholder="Procurement records incomplete"
            required
          />
        </div>

        <div>
          <Label htmlFor="classification">Classification</Label>
          <select
            id="classification"
            value={classification}
            onChange={(e) => {
              setClassification(e.target.value as (typeof CLASSIFICATIONS)[number]);
            }}
            className="block w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm shadow-sm focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
          >
            {CLASSIFICATIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
            {create.isPending ? "Creating…" : "Create finding"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
