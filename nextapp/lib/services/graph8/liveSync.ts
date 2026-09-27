/** Replaces an organization's deal data with its real deals from Graph8:
 * wipes existing (demo) deal-derived rows, analyzes every closed deal, then
 * refreshes patterns, recommendations and open-deal warnings once. */
import { prisma } from "../../db";
import type { Graph8Provider } from "./base";
import { runInvestigation } from "../investigations/orchestrator";
import { refreshPatternsForSegment } from "../patterns/engine";
import { refreshRecommendations } from "../recommendations/engine";
import { refreshFutureWarnings } from "../warnings/engine";
import { getLogger } from "../../logging";

const logger = getLogger("liveSync");

export async function clearOrgDealData(organizationId: string) {
  const deals = await prisma.deal.findMany({ where: { organizationId }, select: { id: true } });
  const dealIds = deals.map((d) => d.id);
  const patterns = await prisma.pattern.findMany({ where: { organizationId }, select: { id: true } });
  const patternIds = patterns.map((p) => p.id);
  const recs = await prisma.recommendation.findMany({ where: { organizationId }, select: { id: true } });

  await prisma.$transaction([
    prisma.recommendationAction.deleteMany({ where: { recommendationId: { in: recs.map((r) => r.id) } } }),
    prisma.recommendation.deleteMany({ where: { organizationId } }),
    prisma.futureDealWarning.deleteMany({ where: { organizationId } }),
    prisma.patternOccurrence.deleteMany({ where: { patternId: { in: patternIds } } }),
    prisma.pattern.deleteMany({ where: { organizationId } }),
    prisma.humanFeedback.deleteMany({ where: { organizationId } }),
    prisma.dealEvidence.deleteMany({ where: { organizationId } }),
    prisma.dealAnalysis.updateMany({ where: { organizationId }, data: { primaryFactorId: null } }),
    prisma.dealFactor.deleteMany({ where: { organizationId } }),
    prisma.dealAnalysis.deleteMany({ where: { organizationId } }),
    prisma.dealSnapshot.deleteMany({ where: { dealId: { in: dealIds } } }),
    prisma.dealContact.deleteMany({ where: { dealId: { in: dealIds } } }),
    prisma.deal.deleteMany({ where: { organizationId } }),
    prisma.webhookEvent.deleteMany({ where: { organizationId } }),
  ]);
}

/** Step 1: read the deal lists from Graph8, then replace the org's deal data.
 * Sync runs in three short requests (start, analyze in batches, finish) so
 * each stays within the serverless time limit. */
export async function startLiveSync(organizationId: string, provider: Graph8Provider) {
  let refs: Array<{ id: string; outcome: string }>;
  if (provider.listDealRefs) {
    refs = await provider.listDealRefs();
  } else {
    const closed = await provider.listClosedDeals();
    const active = await provider.listActiveDeals();
    refs = [...closed, ...active].map((d) => ({ id: d.externalId, outcome: d.outcome }));
  }
  await clearOrgDealData(organizationId);
  return {
    closed: refs.filter((r) => r.outcome !== "open"),
    active: refs.filter((r) => r.outcome === "open"),
  };
}

/** Step 2: import a small batch of deals; closed ones are also analyzed. */
export async function analyzeLiveDeals(
  organizationId: string,
  provider: Graph8Provider,
  deals: Array<{ id: string; outcome: string }>
) {
  let analyzed = 0;
  let failed = 0;
  await Promise.all(
    deals.map(async ({ id, outcome }) => {
      provider.rememberOutcome?.(id, outcome);
      try {
        await runInvestigation({ organizationId, provider, graph8DealId: id, skipRefresh: true, createGraph8Tasks: false });
        analyzed++;
      } catch (err) {
        failed++;
        logger.exception("live_sync_deal_failed", err, { graph8DealId: id });
      }
    })
  );
  return { analyzed, failed };
}

/** Step 3: build patterns, recommendations and open-deal warnings once. */
export async function finishLiveSync(organizationId: string, provider: Graph8Provider) {
  const segments = await prisma.deal.findMany({
    where: { organizationId },
    select: { industry: true, segment: true },
    distinct: ["industry", "segment"],
  });
  for (const { industry, segment } of segments) {
    await refreshPatternsForSegment({ organizationId, industry, segment });
  }
  await refreshRecommendations({ organizationId });
  await refreshFutureWarnings({ organizationId, provider, useStoredOpenDeals: true });

  await prisma.graph8Connection.update({
    where: { organizationId },
    data: { lastSyncAt: new Date().toISOString() },
  });

  return {
    patterns: await prisma.pattern.count({ where: { organizationId } }),
    recommendations: await prisma.recommendation.count({ where: { organizationId } }),
    warnings: await prisma.futureDealWarning.count({ where: { organizationId } }),
  };
}
