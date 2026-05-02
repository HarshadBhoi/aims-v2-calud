"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type SyntheticEvent } from "react";

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
  const searchParams = useSearchParams();
  const utils = trpc.useUtils();

  // Slice B W3.2-3: the report composer's attestsTo dropdown is filtered
  // to the engagement's currently-attached packs. Each report attests to
  // exactly one pack; multi-report-per-engagement is supported (one
  // GAGAS + one IIA on the same engagement) but the schema's unique
  // constraint blocks two reports against the same pack-version pair.
  const attached = trpc.pack.listAttached.useQuery({ engagementId: params.id });

  // Pre-select either: explicit ?attestsTo=CODE:VERSION query param (used
  // by the "compose another report" affordance to pre-pick a non-primary
  // pack), the engagement's primary methodology, or the first attachment.
  const queryParamPack = searchParams.get("attestsTo");
  const defaultAttestsTo = useMemo(() => {
    if (!attached.data) return null;
    if (queryParamPack) {
      const [code, version] = queryParamPack.split(":");
      const match = attached.data.find(
        (a) => a.packCode === code && a.packVersion === version,
      );
      if (match) return `${match.packCode}:${match.packVersion}`;
    }
    const primary = attached.data.find((a) => a.isPrimary);
    if (primary) return `${primary.packCode}:${primary.packVersion}`;
    const first = attached.data[0];
    if (first) return `${first.packCode}:${first.packVersion}`;
    return null;
  }, [attached.data, queryParamPack]);

  const [title, setTitle] = useState("");
  const [attestsTo, setAttestsTo] = useState<string | null>(null);

  // Sync the dropdown to the resolved default once the query lands.
  useEffect(() => {
    if (attestsTo === null && defaultAttestsTo !== null) {
      setAttestsTo(defaultAttestsTo);
    }
  }, [attestsTo, defaultAttestsTo]);

  const create = trpc.report.create.useMutation({
    onSuccess: async (report) => {
      await utils.report.list.invalidate({ engagementId: params.id });
      router.replace(`/dashboard/engagements/${params.id}/reports/${report.id}`);
    },
  });

  const handleSubmit = (e: SyntheticEvent): void => {
    e.preventDefault();
    if (!attestsTo) return;
    const [packCode, packVersion] = attestsTo.split(":");
    if (!packCode || !packVersion) return;
    create.mutate({
      engagementId: params.id,
      title,
      attestsToPackCode: packCode,
      attestsToPackVersion: packVersion,
    });
  };

  if (attached.isLoading) {
    return (
      <Card>
        <CardTitle>New report</CardTitle>
        <CardDescription>Loading attached packs…</CardDescription>
      </Card>
    );
  }

  if (!attached.data || attached.data.length === 0) {
    return (
      <Card>
        <CardTitle>New report</CardTitle>
        <CardDescription>
          This engagement has no attached packs. Attach at least one
          methodology pack before composing a report.
        </CardDescription>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>New report</CardTitle>
      <CardDescription>
        Generates the engagement report from the current findings + pack
        attachments. You&rsquo;ll fill in narrative sections on the next screen.
      </CardDescription>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <div>
          <Label htmlFor="attestsTo">Attests to (target methodology)</Label>
          <select
            id="attestsTo"
            aria-label="Attests to (target methodology)"
            title="Target methodology this report attests to"
            value={attestsTo ?? ""}
            onChange={(e) => {
              setAttestsTo(e.target.value);
            }}
            className="block w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
            required
          >
            {attached.data.map((a) => (
              <option
                key={`${a.packCode}:${a.packVersion}`}
                value={`${a.packCode}:${a.packVersion}`}
              >
                {a.name} ({a.packCode}:{a.packVersion}){" "}
                {a.isPrimary ? "— primary" : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-black/60">
            Findings will be rendered using this pack&rsquo;s vocabulary. Each
            engagement may have at most one report per pack version.
          </p>
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
          <Button type="submit" disabled={create.isPending || !attestsTo}>
            {create.isPending ? "Generating…" : "Generate report"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
