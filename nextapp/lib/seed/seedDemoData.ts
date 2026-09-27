/** Loads the demo deals into one organization and analyzes them. Shared by the
 * `npm run seed` script and the Settings "Restore demo data" button. */
import { prisma } from "../db";
import { DemoGraph8Provider } from "../services/graph8/demoProvider";
import { syncDeal } from "../services/graph8/sync";
import { runInvestigation } from "../services/investigations/orchestrator";
import { refreshPatternsForSegment } from "../services/patterns/engine";
import { refreshRecommendations } from "../services/recommendations/engine";
import { refreshFutureWarnings } from "../services/warnings/engine";
import { ACTIVE_DEALS, CLOSED_DEALS } from "./demoDeals";

export async function seedDemoData(orgId: string, log: (msg: string) => void = () => {}) {
  const provider = new DemoGraph8Provider();

  for (const dealRaw of CLOSED_DEALS) {
    log(`Analyzing deal: ${dealRaw.company_name}`);
    await runInvestigation({ organizationId: orgId, provider, graph8DealId: dealRaw.external_id, skipRefresh: true });
  }

  const distinctSegments = await prisma.deal.findMany({
    where: { organizationId: orgId },
    select: { industry: true, segment: true },
    distinct: ["industry", "segment"],
  });
  for (const { industry, segment } of distinctSegments) {
    await refreshPatternsForSegment({ organizationId: orgId, industry, segment });
  }

  await refreshRecommendations({ organizationId: orgId });

  for (const dealRaw of ACTIVE_DEALS) {
    await syncDeal({ organizationId: orgId, provider, graph8DealId: dealRaw.external_id });
  }

  await refreshFutureWarnings({ organizationId: orgId, provider });
}
