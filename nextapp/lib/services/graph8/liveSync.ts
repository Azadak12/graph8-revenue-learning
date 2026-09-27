/** Replaces an organization's deal data with its real deals from Graph8:
 * wipes existing (demo) deal-derived rows, analyzes every closed deal, then
 * refreshes patterns, recommendations and open-deal warnings once. */
import { prisma } from "../../db";
import type { Graph8Provider } from "./base";
import { syncDeal } from "./sync";
import { runInvestigation } from "../investigations/orchestrator";
import { refreshPatternsForSegment } from "../patterns/engine";
import { refreshRecommendations } from "../recommendations/engine";
import { refreshFutureWarnings } from "../warnings/engine";
import { getLogger } from "../../logging";

const logger = getLogger("liveSync");

async function clearOrgDealData(organizationId: string) {
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

export async function syncOrgFromGraph8(organizationId: string, provider: Graph8Provider) {
  const closed = await provider.listClosedDeals();
  const active = await provider.listActiveDeals();

  await clearOrgDealData(organizationId);

  let analyzed = 0;
  let failed = 0;
  for (const g8Deal of closed) {
    try {
      await runInvestigation({ organizationId, provider, graph8DealId: g8Deal.externalId, skipRefresh: true });
      analyzed++;
    } catch (err) {
      failed++;
      logger.exception("live_sync_deal_failed", err, { graph8DealId: g8Deal.externalId });
    }
  }

  const segments = await prisma.deal.findMany({
    where: { organizationId },
    select: { industry: true, segment: true },
    distinct: ["industry", "segment"],
  });
  for (const { industry, segment } of segments) {
    await refreshPatternsForSegment({ organizationId, industry, segment });
  }
  await refreshRecommendations({ organizationId });
  await refreshFutureWarnings({ organizationId, provider });

  await prisma.graph8Connection.update({
    where: { organizationId },
    data: { lastSyncAt: new Date().toISOString() },
  });

  return { closed: closed.length, active: active.length, analyzed, failed };
}
