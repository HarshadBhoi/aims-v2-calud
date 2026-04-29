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

export default function NewReportPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const utils = trpc.useUtils();

  const create = trpc.report.create.useMutation({
    onSuccess: async (report) => {
      await utils.report.list.invalidate({ engagementId: params.id });
      router.replace(`/dashboard/engagements/${params.id}/reports/${report.id}`);
    },
  });

  const [title, setTitle] = useState("");

  return (
    <Card>
      <CardTitle>New report</CardTitle>
      <CardDescription>
        Generates the engagement report from the current findings + pack
        attachments. You&rsquo;ll fill in narrative sections on the next screen.
      </CardDescription>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ engagementId: params.id, title });
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
            placeholder="FY26 Audit Report"
            required
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
            {create.isPending ? "Generating…" : "Generate report"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
