/** Ported from backend/app/services/reps/engine.py */
import { prisma } from "../../db";
import type { Department, Preventability } from "@prisma/client";

const COACHABLE_DEPARTMENTS: Department[] = ["sales", "sales_engineering"];
const COACHABLE_PREVENTABILITY: Preventability[] = ["preventable", "potentially_preventable"];

async function effectiveCategoriesForDeal(dealId: string): Promise<Map<string, string>> {
  const analysis = await prisma.dealAnalysis.findFirst({ where: { dealId, isCurrent: true } });
  if (!analysis) return new Map();
  const factors = await prisma.dealFactor.findMany({
    where: {
      dealAnalysisId: analysis.id,
      department: { in: COACHABLE_DEPARTMENTS },
      preventability: { in: COACHABLE_PREVENTABILITY },
    },
  });
  const map = new Map<string, string>();
  for (const f of factors) map.set(f.category, f.specificIssue);
  return map;
}

export async function buildRepPerformance(args: { organizationId: string }) {
  const { organizationId } = args;
  const deals = await prisma.deal.findMany({
    where: { organizationId, outcome: { in: ["won", "lost"] }, ownerName: { not: null } },
  });

  const byOwner = new Map<string, typeof deals>();
  for (const deal of deals) {
    const key = deal.ownerName!;
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key)!.push(deal);
  }

  const reps = [];
  for (const [ownerName, ownerDeals] of byOwner) {
    const won = ownerDeals.filter((d) => d.outcome === "won").length;
    const lost = ownerDeals.filter((d) => d.outcome === "lost").length;
    const total = won + lost;

    const buckets = new Map<string, { issues: Set<string>; deals: { id: string; company_name: string }[] }>();
    for (const deal of ownerDeals) {
      if (deal.outcome !== "lost") continue;
      const categories = await effectiveCategoriesForDeal(deal.id);
      for (const [category, specificIssue] of categories) {
        if (!buckets.has(category)) buckets.set(category, { issues: new Set(), deals: [] });
        const bucket = buckets.get(category)!;
        bucket.issues.add(specificIssue);
        bucket.deals.push({ id: deal.id, company_name: deal.companyName });
      }
    }

    const coachingItems = Array.from(buckets.entries()).map(([category, data]) => ({
      category,
      issue_examples: Array.from(data.issues).sort().slice(0, 3),
      deal_count: data.deals.length,
      deals: data.deals,
      recurring: data.deals.length >= 2,
    }));
    coachingItems.sort((a, b) => b.deal_count - a.deal_count);

    reps.push({
      owner_name: ownerName,
      total_deals: total,
      won,
      lost,
      win_rate: total > 0 ? Math.round((won / total) * 100) : null,
      coaching_items: coachingItems,
    });
  }

  reps.sort(
    (a, b) =>
      b.coaching_items.reduce((s, c) => s + c.deal_count, 0) -
      a.coaching_items.reduce((s, c) => s + c.deal_count, 0)
  );
  return reps;
}
