/**
 * Pack resolver.
 *
 * For slice A (single pack per engagement, no annotations), the resolver
 * is a straightforward extract-from-pack-content: load the attached pack,
 * return its shape as the effective requirements.
 *
 * Structured so that slice B can layer on:
 *   - multi-pack union via strictness direction (max/min/union/override)
 *   - annotation overlays (tighten / override_required / loosen)
 * without re-architecting call sites.
 */

import {
  type DocumentationRequirements,
  type FindingClassificationRequirement,
  type FindingElementRequirement,
  type ResolvedRequirements,
} from "@aims/validation";
import { TRPCError } from "@trpc/server";

import { type AuthedPrisma } from "../trpc";

/** Shape we expect inside StandardPack.packContent for slice A packs. */
type ExpectedPackContent = {
  findingElements?: FindingElementRequirement[];
  findingClassifications?: FindingClassificationRequirement[];
  documentationRequirements?: DocumentationRequirements;
};

export async function resolvePackRequirements(
  engagementId: string,
  prisma: AuthedPrisma,
): Promise<ResolvedRequirements> {
  const attachments = await prisma.packAttachment.findMany({
    where: { engagementId },
    include: { pack: true },
  });

  if (attachments.length === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No packs attached to this engagement. Attach at least one pack first.",
    });
  }

  // Slice A: exactly one pack expected. Multi-pack arrives in slice B.
  if (attachments.length > 1) {
    throw new TRPCError({
      code: "NOT_IMPLEMENTED",
      message:
        "Multi-pack resolution is not implemented in Slice A. Attach only one pack per engagement.",
    });
  }

  const attachment = attachments[0];
  if (!attachment) {
    // Unreachable given the length check above, but narrows the type.
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "no attachment after length check" });
  }

  const content = attachment.pack.packContent as ExpectedPackContent;

  return {
    findingElements: content.findingElements ?? [],
    findingClassifications: content.findingClassifications ?? [],
    documentationRequirements:
      content.documentationRequirements ?? DEFAULT_DOCUMENTATION_REQUIREMENTS,
    sources: [
      { packCode: attachment.pack.code, packVersion: attachment.pack.version },
    ],
  };
}

const DEFAULT_DOCUMENTATION_REQUIREMENTS: DocumentationRequirements = {
  fourElementComplete: true,
  workPaperCitationRequired: false,
  retentionYears: 7,
};
