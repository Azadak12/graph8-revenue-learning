/** Ported from backend/app/services/warnings/engine.py */
import { prisma } from "../../db";
import type { Deal, Pattern } from "@prisma/client";
import type { Graph8Provider } from "../graph8/base";
import { syncDeal } from "../graph8/sync";

const QUALIFYING_STRENGTHS = ["emerging_pattern", "recurring_pattern", "strong_pattern"];

const RESOLVED_IF_REQUIREMENT_MENTIONS: Record<string, string[]> = {
  scim_provisioning: ["scim", "provisioning"],
};

function patternMatchesDeal(pattern: Pattern, industry: string, segment: string): boolean {
  const segDef = pattern.segmentDefinition as Record<string, string>;
  if ("industry" in segDef) {
    return segDef.industry === industry && segDef.segment === segment;
  }
  return segDef.segment === segment;
}

export async function refreshFutureWarnings(args: {
  organizationId: string;
  provider: Graph8Provider;
  /** Use the open deals already synced to the database instead of re-fetching them. */
  useStoredOpenDeals?: boolean;
}) {
  const { organizationId, provider, useStoredOpenDeals } = args;
  const patterns = await prisma.pattern.findMany({
    where: { organizationId, status: "active", patternStrength: { in: QUALIFYING_STRENGTHS as any } },
  });

  const openDeals: Array<{ deal: Deal; requirements: string[] }> = [];
  if (useStoredOpenDeals) {
    const stored = await prisma.deal.findMany({ where: { organizationId, outcome: "open" } });
    for (const deal of stored) openDeals.push({ deal, requirements: [] });
  } else {
    for (const g8Deal of await provider.listActiveDeals()) {
      const { deal, bundle } = await syncDeal({ organizationId, provider, graph8DealId: g8Deal.externalId });
      openDeals.push({ deal, requirements: bundle.requirements });
    }
  }

  const created = [];
  for (const { deal, requirements } of openDeals) {

    for (const pattern of patterns) {
      if (!patternMatchesDeal(pattern, deal.industry, deal.segment)) continue;

      const segDef = pattern.segmentDefinition as Record<string, string>;
      const bucketKey = segDef.bucket_key || "";
      const resolvedKeywords = RESOLVED_IF_REQUIREMENT_MENTIONS[bucketKey];
      if (
        resolvedKeywords &&
        requirements.some((r) => resolvedKeywords.some((kw) => r.toLowerCase().includes(kw)))
      ) {
        continue;
      }

      let existing = await prisma.futureDealWarning.findFirst({
        where: { dealId: deal.id, patternId: pattern.id },
      });
      if (existing && ["acknowledged", "dismissed", "task_created"].includes(existing.status)) {
        continue;
      }

      const explanation = `${pattern.narrative} This deal shares the same industry/segment profile.`;
      const similarityBasis = {
        industry: deal.industry,
        segment: deal.segment,
        pattern_id: pattern.id,
        pattern_name: pattern.name,
      };

      if (!existing) {
        existing = await prisma.futureDealWarning.create({
          data: {
            organizationId,
            dealId: deal.id,
            patternId: pattern.id,
            status: "open",
            explanation,
            similarityBasis,
          },
        });
      } else {
        existing = await prisma.futureDealWarning.update({
          where: { id: existing.id },
          data: { explanation, similarityBasis },
        });
      }
      created.push(existing);
    }
  }

  return created;
}
