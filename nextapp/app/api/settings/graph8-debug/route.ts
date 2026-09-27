import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth";
import { withErrorHandling } from "../../../../lib/apiHelpers";
import { settings } from "../../../../lib/config";
import { decryptSecret } from "../../../../lib/secrets";
import { cleanApiKey } from "../../../../lib/services/graph8/liveProvider";

export const dynamic = "force-dynamic";

const FIELDS = /name|stage|outcome|status|won|lost|close|company|industry|employee|size|amount|owner|created/i;
const pick = (obj: any) =>
  obj && typeof obj === "object"
    ? Object.fromEntries(Object.entries(obj).filter(([k]) => FIELDS.test(k)).map(([k, v]) => [k, typeof v === "object" ? JSON.stringify(v)?.slice(0, 200) : v]))
    : obj;

/** Read-only summary of what Sync stored, plus one raw Graph8 deal and its
 * company, to see why learnings may be missing. Contains no secrets. */
export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const organizationId = user.organizationId;

    const deals = await prisma.deal.findMany({
      where: { organizationId },
      select: { name: true, outcome: true, industry: true, segment: true, companyName: true },
    });
    const groups: Record<string, number> = {};
    for (const d of deals) groups[`${d.outcome} | ${d.industry} | ${d.segment}`] = (groups[`${d.outcome} | ${d.industry} | ${d.segment}`] || 0) + 1;
    const analyses = await prisma.dealAnalysis.groupBy({ by: ["status"], where: { organizationId, isCurrent: true }, _count: true });

    const db = {
      deals: deals.length,
      deals_by_outcome_industry_segment: groups,
      sample_deal_names: deals.slice(0, 4).map((d) => `${d.name} [${d.companyName}]`),
      analyses_by_status: Object.fromEntries(analyses.map((a) => [a.status, a._count])),
      factors: await prisma.dealFactor.count({ where: { organizationId } }),
      patterns: await prisma.pattern.count({ where: { organizationId } }),
      recommendations: await prisma.recommendation.count({ where: { organizationId } }),
      warnings: await prisma.futureDealWarning.count({ where: { organizationId } }),
    };

    let graph8: any = null;
    const connection = await prisma.graph8Connection.findUnique({ where: { organizationId } });
    if (connection?.mode === "live" && connection.encryptedApiKeyRef) {
      const key = cleanApiKey(decryptSecret(connection.encryptedApiKeyRef));
      const get = async (path: string) => {
        const res = await fetch(settings.graph8BaseUrl + path, { headers: { Authorization: `Bearer ${key}` } });
        return { status: res.status, body: await res.json().catch(() => null) };
      };
      const won = await get("/deals?outcome=won&limit=1");
      const deal = won.body?.data?.[0];
      const detail = deal ? await get(`/deals/${deal.id}`) : null;
      const company = deal?.company_id ? await get(`/companies/${deal.company_id}`) : null;
      graph8 = {
        won_list_status: won.status,
        won_total: won.body?.pagination?.total,
        list_deal: pick(deal),
        detail_status: detail?.status,
        detail_deal: pick(detail?.body?.data),
        company_status: company?.status,
        company: pick(company?.body?.data),
      };
    }

    return NextResponse.json({ db, graph8 });
  });
}
