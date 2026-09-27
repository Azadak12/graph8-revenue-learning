/** Turns qualifying Patterns into department-specific Recommendations.
 * Ported from backend/app/services/recommendations/engine.py. */
import type { Pattern, Recommendation, Department } from "@prisma/client";
import { prisma } from "../../db";
import { rulesForBucket } from "./rules";

const QUALIFYING_STRENGTHS = ["emerging_pattern", "recurring_pattern", "strong_pattern"];

export async function refreshRecommendations(args: { organizationId: string }): Promise<Recommendation[]> {
  const { organizationId } = args;
  const patterns = await prisma.pattern.findMany({
    where: { organizationId, patternStrength: { in: QUALIFYING_STRENGTHS as any } },
  });

  const bestByRule = new Map<string, { rule: ReturnType<typeof rulesForBucket>[number]; pattern: Pattern }>();
  for (const pattern of patterns) {
    const segDef = pattern.segmentDefinition as Record<string, string>;
    const bucketKey = segDef.bucket_key || "";
    for (const rule of rulesForBucket(bucketKey)) {
      const key = `${rule.department}::${rule.title}`;
      const current = bestByRule.get(key);
      if (!current || pattern.lostCount > current.pattern.lostCount) {
        bestByRule.set(key, { rule, pattern });
      }
    }
  }

  const seenIds = new Set<string>();
  const result: Recommendation[] = [];
  for (const [, { rule, pattern }] of bestByRule) {
    let existing = await prisma.recommendation.findFirst({
      where: { organizationId, department: rule.department, title: rule.title },
    });
    if (!existing) {
      existing = await prisma.recommendation.create({
        data: {
          organizationId,
          department: rule.department,
          status: "proposed",
          patternId: pattern.id,
          title: rule.title,
          explanation: rule.explanation,
          recommendedAction: rule.recommendedAction,
          priority: rule.priority,
        },
      });
    } else {
      existing = await prisma.recommendation.update({
        where: { id: existing.id },
        data: {
          patternId: pattern.id,
          title: rule.title,
          explanation: rule.explanation,
          recommendedAction: rule.recommendedAction,
          priority: rule.priority,
        },
      });
    }
    seenIds.add(existing.id);
    result.push(existing);
  }

  const stale = await prisma.recommendation.findMany({
    where: {
      organizationId,
      status: "proposed",
      ...(seenIds.size > 0 ? { id: { notIn: Array.from(seenIds) } } : {}),
    },
  });
  if (stale.length > 0) {
    await prisma.recommendation.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
  }

  return result;
}
