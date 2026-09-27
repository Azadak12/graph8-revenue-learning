/** Ported from backend/app/services/overview.py */
import { prisma } from "../db";
import { serializePattern } from "./serialize";

const QUALIFYING_STRENGTHS = ["emerging_pattern", "recurring_pattern", "strong_pattern"];

export async function buildOverview(args: { organizationId: string }) {
  const { organizationId } = args;
  const deals = await prisma.deal.findMany({ where: { organizationId } });
  const won = deals.filter((d) => d.outcome === "won").length;
  const lost = deals.filter((d) => d.outcome === "lost").length;

  const awaiting = await prisma.dealAnalysis.count({
    where: { organizationId, isCurrent: true, status: "needs_clarification" },
  });

  const patterns = await prisma.pattern.findMany({
    where: { organizationId, patternStrength: { in: QUALIFYING_STRENGTHS as any } },
    orderBy: { lostCount: "desc" },
    include: { recommendations: true },
  });

  let executiveSummary = patterns.slice(0, 4).map((p) => p.narrative);
  if (executiveSummary.length === 0) {
    executiveSummary = ["Not enough closed deals analyzed yet to surface organization-wide patterns."];
  }

  const focusDepartments = new Map<string, number>();
  for (const pattern of patterns) {
    for (const rec of pattern.recommendations) {
      focusDepartments.set(rec.department, (focusDepartments.get(rec.department) || 0) + 1);
    }
  }
  const focusAreas = Array.from(focusDepartments.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([d]) => d);

  const recentLearnings = patterns.slice(0, 6).map((p) => p.narrative);

  return {
    total_deals_analyzed: won + lost,
    won_count: won,
    lost_count: lost,
    awaiting_clarification: awaiting,
    executive_summary: executiveSummary,
    emerging_patterns: patterns.map(serializePattern),
    focus_areas: focusAreas,
    recent_learnings: recentLearnings,
  };
}
