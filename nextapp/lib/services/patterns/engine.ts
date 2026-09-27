/** Deterministic won/lost pattern engine — ported from
 * backend/app/services/patterns/engine.py. Nothing here calls the LLM. */
import type { FactorCategory, DealSegment, Pattern } from "@prisma/client";
import { prisma } from "../../db";
import { bucketDefinition, bucketKeyForFactor, formatNarrative } from "./bucketing";
import { computeStrength } from "./strength";

async function effectiveCategoriesForDeal(dealId: string): Promise<Array<[FactorCategory, string]>> {
  const analysis = await prisma.dealAnalysis.findFirst({
    where: { dealId, isCurrent: true },
  });
  if (!analysis) return [];

  const feedback = await prisma.humanFeedback.findFirst({
    where: { analysisId: analysis.id, overrideCategory: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (feedback?.overrideCategory) {
    return [[feedback.overrideCategory, feedback.selectedReason || feedback.overrideCategory]];
  }

  const factors = await prisma.dealFactor.findMany({ where: { dealAnalysisId: analysis.id } });
  const seen = new Map<string, [FactorCategory, string]>();
  for (const f of factors) seen.set(`${f.category}::${f.specificIssue}`, [f.category, f.specificIssue]);
  return Array.from(seen.values());
}

interface BucketStat {
  lost: Set<string>;
  won: Set<string>;
}

async function factorBucketStats(deals: Array<{ id: string; outcome: string }>): Promise<Map<string, BucketStat>> {
  const stats = new Map<string, BucketStat>();
  for (const deal of deals) {
    if (deal.outcome !== "won" && deal.outcome !== "lost") continue;
    const cohort = deal.outcome === "lost" ? "lost" : "won";
    const categories = await effectiveCategoriesForDeal(deal.id);
    for (const [category, issue] of categories) {
      const key = bucketKeyForFactor(category, issue);
      if (!stats.has(key)) stats.set(key, { lost: new Set(), won: new Set() });
      stats.get(key)![cohort].add(deal.id);
    }
  }
  return stats;
}

async function decisionMakerLateDealIds(deals: Array<{ id: string }>): Promise<Set<string>> {
  const late = new Set<string>();
  for (const deal of deals) {
    const allContacts = await prisma.dealContact.findMany({ where: { dealId: deal.id } });
    // No buying-role data for this deal (e.g. roles not returned by Graph8):
    // don't guess, leave it to what the notes say.
    if (!allContacts.some((c) => c.role !== "unknown")) continue;
    const contacts = allContacts.filter((c) => c.role === "decision_maker");
    const proposalSnapshot = await prisma.dealSnapshot.findFirst({
      where: { dealId: deal.id, stageName: { contains: "proposal", mode: "insensitive" } },
      orderBy: { enteredAt: "asc" },
    });
    if (contacts.length === 0) {
      late.add(deal.id);
      continue;
    }
    const engagedDates = contacts.map((c) => c.engagedAt).filter((d): d is Date => !!d);
    if (engagedDates.length === 0) {
      late.add(deal.id);
      continue;
    }
    const earliestEngaged = new Date(Math.min(...engagedDates.map((d) => d.getTime())));
    if (proposalSnapshot && earliestEngaged >= proposalSnapshot.enteredAt) {
      late.add(deal.id);
    }
  }
  return late;
}

function bucketKeyToCategory(bucketKey: string): FactorCategory {
  const mapping: Record<string, FactorCategory> = {
    scim_provisioning: "product_capability_gap",
    pricing_packaging: "pricing",
    missing_decision_maker: "missing_decision_maker",
    competitor: "competitor",
    proposal_delay: "proposal_delay",
  };
  if (mapping[bucketKey]) return mapping[bucketKey];
  const allCategories: FactorCategory[] = [
    "product_capability_gap", "integration_gap", "pricing", "packaging", "competitor", "security",
    "compliance", "privacy", "legal", "implementation", "support", "wrong_fit",
    "missing_decision_maker", "weak_champion", "stakeholder_misalignment", "poor_discovery",
    "poor_demo", "slow_followup", "proposal_delay", "communication", "value_not_proven",
    "roi_not_proven", "timing", "budget", "priority_change", "buyer_project_cancelled",
    "procurement", "internal_seller_delay", "unknown", "other",
  ];
  return (allCategories as string[]).includes(bucketKey) ? (bucketKey as FactorCategory) : "other";
}

async function upsertPattern(args: {
  organizationId: string;
  category: FactorCategory;
  bucketKey: string;
  segmentDefinition: Record<string, string>;
  lostIds: Set<string>;
  wonIds: Set<string>;
  totalLost: number;
  totalWon: number;
}): Promise<Pattern | null> {
  const { organizationId, category, bucketKey, segmentDefinition, lostIds, wonIds, totalLost, totalWon } = args;
  const result = computeStrength({
    lostWithFactor: lostIds.size,
    wonWithFactor: wonIds.size,
    totalLost,
    totalWon,
  });
  if (result === null) return null;
  const { strength, confidence } = result;

  const definition = bucketDefinition(bucketKey);
  let narrative = formatNarrative(definition.narrative, {
    lost_count: lostIds.size,
    won_count: wonIds.size,
    total_lost: totalLost,
    total_won: totalWon,
    industry: segmentDefinition.industry || "",
    segment: segmentDefinition.segment === "smb" ? "SMB" : (segmentDefinition.segment || "").replace(/_/g, "-"),
  });

  // Ground the learning in its deals: biggest examples and lost pipeline.
  if (lostIds.size > 0) {
    const lostDeals = await prisma.deal.findMany({
      where: { id: { in: Array.from(lostIds) } },
      select: { name: true, companyName: true, amount: true },
      orderBy: { amount: "desc" },
    });
    const pipeline = lostDeals.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const names = lostDeals.slice(0, 3).map((d) => d.companyName || d.name.split(" - ")[0]);
    const money = pipeline >= 1_000_000 ? `$${(pipeline / 1_000_000).toFixed(1)}M` : `$${Math.round(pipeline / 1_000)}K`;
    narrative += ` ${money} in lost pipeline; examples: ${names.join(", ")}.`;
  }

  const existing = await prisma.pattern.findMany({ where: { organizationId, category } });
  let pattern = existing.find((p) => {
    const seg = p.segmentDefinition as Record<string, string>;
    return (
      seg.bucket_key === bucketKey &&
      seg.segment === segmentDefinition.segment &&
      seg.industry === segmentDefinition.industry
    );
  });

  const now = new Date();
  if (!pattern) {
    pattern = await prisma.pattern.create({
      data: {
        organizationId,
        name: definition.name,
        category,
        segmentDefinition: { ...segmentDefinition, bucket_key: bucketKey },
        lostCount: lostIds.size,
        wonCount: wonIds.size,
        sampleSize: totalLost + totalWon,
        patternStrength: strength,
        confidence,
        narrative,
        firstDetectedAt: now,
        lastDetectedAt: now,
      },
    });
  } else {
    pattern = await prisma.pattern.update({
      where: { id: pattern.id },
      data: {
        lostCount: lostIds.size,
        wonCount: wonIds.size,
        sampleSize: totalLost + totalWon,
        patternStrength: strength,
        confidence,
        narrative,
        lastDetectedAt: now,
      },
    });
  }

  await prisma.patternOccurrence.deleteMany({ where: { patternId: pattern.id } });
  await prisma.patternOccurrence.createMany({
    data: [
      ...Array.from(lostIds).map((dealId) => ({ patternId: pattern!.id, dealId, outcome: "lost" })),
      ...Array.from(wonIds).map((dealId) => ({ patternId: pattern!.id, dealId, outcome: "won" })),
    ],
  });

  return pattern;
}

export async function refreshPatternsForSegment(args: {
  organizationId: string;
  industry: string;
  segment: DealSegment;
}): Promise<Pattern[]> {
  const { organizationId, industry, segment } = args;
  const patterns: Pattern[] = [];

  const industrySegmentDeals = await prisma.deal.findMany({
    where: { organizationId, industry, segment, outcome: { in: ["won", "lost"] } },
  });
  const segmentOnlyDeals = await prisma.deal.findMany({
    where: { organizationId, segment, outcome: { in: ["won", "lost"] } },
  });

  const totalLostIs = industrySegmentDeals.filter((d) => d.outcome === "lost").length;
  const totalWonIs = industrySegmentDeals.filter((d) => d.outcome === "won").length;
  const totalLostS = segmentOnlyDeals.filter((d) => d.outcome === "lost").length;
  const totalWonS = segmentOnlyDeals.filter((d) => d.outcome === "won").length;

  const isStats = await factorBucketStats(industrySegmentDeals);
  const sStats = await factorBucketStats(segmentOnlyDeals);

  // "Decision maker engaged late" combines what the notes say with the
  // stakeholder timing data, instead of one overwriting the other.
  const lateIds = await decisionMakerLateDealIds(segmentOnlyDeals);
  const dm = sStats.get("missing_decision_maker") || { lost: new Set<string>(), won: new Set<string>() };
  for (const d of segmentOnlyDeals) {
    if (!lateIds.has(d.id)) continue;
    if (d.outcome === "lost") dm.lost.add(d.id);
    if (d.outcome === "won") dm.won.add(d.id);
  }
  if (dm.lost.size || dm.won.size) sStats.set("missing_decision_maker", dm);

  const seenBucketKeys = new Set([...isStats.keys(), ...sStats.keys()]);
  for (const bucketKey of seenBucketKeys) {
    const grain = bucketDefinition(bucketKey).grain;
    let stat: BucketStat;
    let segDef: Record<string, string>;
    let totalLost: number;
    let totalWon: number;
    if (grain === "industry_segment") {
      stat = isStats.get(bucketKey) || { lost: new Set(), won: new Set() };
      segDef = { industry, segment };
      totalLost = totalLostIs;
      totalWon = totalWonIs;
    } else {
      stat = sStats.get(bucketKey) || { lost: new Set(), won: new Set() };
      segDef = { segment };
      totalLost = totalLostS;
      totalWon = totalWonS;
    }

    const pattern = await upsertPattern({
      organizationId,
      category: bucketKeyToCategory(bucketKey),
      bucketKey,
      segmentDefinition: segDef,
      lostIds: stat.lost,
      wonIds: stat.won,
      totalLost,
      totalWon,
    });
    if (pattern) patterns.push(pattern);
  }

  return patterns;
}
