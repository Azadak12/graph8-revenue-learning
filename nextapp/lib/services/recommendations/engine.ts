/** Turns qualifying Patterns into department-specific Recommendations.
 * Each recommendation is written from the pattern's own deals: the segment it
 * applies to, the won/lost counts, the lost pipeline, example companies and a
 * quote from the deals' notes. Ported from
 * backend/app/services/recommendations/engine.py, then made data-driven. */
import type { Pattern, Recommendation } from "@prisma/client";
import { prisma } from "../../db";
import { bucketKeyForFactor } from "../patterns/bucketing";
import { fillTemplate, rulesForBucket } from "./rules";

const QUALIFYING_STRENGTHS = ["emerging_pattern", "recurring_pattern", "strong_pattern"];

const SEGMENT_NAMES: Record<string, string> = { enterprise: "enterprise", mid_market: "mid-market", smb: "SMB" };

export function segmentLabel(segDef: Record<string, string>): string {
  const segment = SEGMENT_NAMES[segDef.segment] || (segDef.segment || "").replace(/_/g, "-");
  return [segDef.industry, segment].filter(Boolean).join(" ") || "all";
}

const sentence = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export function formatMoney(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount}`;
}

/** Example deals, lost pipeline and one supporting quote for a pattern. */
async function patternEvidence(pattern: Pattern) {
  const bucketKey = (pattern.segmentDefinition as Record<string, string>).bucket_key || "";
  const occurrences = await prisma.patternOccurrence.findMany({ where: { patternId: pattern.id, outcome: "lost" } });
  const dealIds = occurrences.map((o) => o.dealId);
  const deals = await prisma.deal.findMany({
    where: { id: { in: dealIds } },
    select: { id: true, name: true, companyName: true, amount: true },
    orderBy: { amount: "desc" },
  });
  const lostPipeline = deals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
  const examples = deals.slice(0, 3).map((d) => d.companyName || d.name.split(" - ")[0]);

  // A quote from the notes behind a factor in this pattern's bucket.
  let quote: string | null = null;
  const evidence = await prisma.dealEvidence.findMany({
    where: { dealId: { in: dealIds }, factorId: { not: null } },
    include: { factor: true },
    orderBy: { strength: "desc" },
    take: 50,
  });
  const match = evidence.find((e) => e.factor && bucketKeyForFactor(e.factor.category, e.factor.specificIssue) === bucketKey);
  if (match) quote = (match.excerpt || match.finding).slice(0, 220);

  return { lostPipeline, examples, quote };
}

function priorityFor(rulePriority: string, strength: string): string {
  if (strength === "strong_pattern" || strength === "recurring_pattern") return rulePriority;
  return rulePriority === "high" ? "medium" : "low";
}

export async function refreshRecommendations(args: { organizationId: string }): Promise<Recommendation[]> {
  const { organizationId } = args;
  const patterns = await prisma.pattern.findMany({
    where: { organizationId, patternStrength: { in: QUALIFYING_STRENGTHS as any } },
    orderBy: { lostCount: "desc" },
  });

  const seenIds = new Set<string>();
  const result: Recommendation[] = [];
  for (const pattern of patterns) {
    const segDef = pattern.segmentDefinition as Record<string, string>;
    const rules = rulesForBucket(segDef.bucket_key || "");
    if (rules.length === 0) continue;

    const vars = { segment_label: segmentLabel(segDef) };
    const { lostPipeline, examples, quote } = await patternEvidence(pattern);
    const stats =
      `Seen in ${pattern.lostCount} lost ${vars.segment_label} deals (${formatMoney(lostPipeline)} lost pipeline) ` +
      `versus ${pattern.wonCount} won, out of ${pattern.sampleSize} closed deals in this segment.` +
      (examples.length ? ` Examples: ${examples.join(", ")}.` : "") +
      (quote ? ` From the notes: "${quote}"` : "");

    for (const rule of rules) {
      const title = fillTemplate(rule.title, vars);
      const data = {
        patternId: pattern.id,
        title,
        explanation: `${sentence(fillTemplate(rule.explanation, vars))} ${stats}`,
        recommendedAction: fillTemplate(rule.recommendedAction, vars),
        priority: priorityFor(rule.priority, pattern.patternStrength),
      };
      let existing = await prisma.recommendation.findFirst({
        where: { organizationId, department: rule.department, title },
      });
      existing = existing
        ? await prisma.recommendation.update({ where: { id: existing.id }, data })
        : await prisma.recommendation.create({
            data: { organizationId, department: rule.department, status: "proposed", ...data },
          });
      seenIds.add(existing.id);
      result.push(existing);
    }
  }

  const stale = await prisma.recommendation.findMany({
    where: {
      organizationId,
      status: "proposed",
      ...(seenIds.size > 0 ? { id: { notIn: Array.from(seenIds) } } : {}),
    },
  });
  if (stale.length > 0) {
    await prisma.recommendationAction.deleteMany({ where: { recommendationId: { in: stale.map((r) => r.id) } } });
    await prisma.recommendation.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
  }

  return result;
}
