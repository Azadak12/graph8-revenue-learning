import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth";
import { jsonError, withErrorHandling } from "../../../../../lib/apiHelpers";
import { getDealOr404, serializeDealDetail } from "../../../../../lib/services/deals";
import { getProviderForOrg } from "../../../../../lib/services/graph8/factory";
import { runInvestigation } from "../../../../../lib/services/investigations/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { dealId: string } }) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const deal = await getDealOr404(user.organizationId, params.dealId);
    if (!deal) return jsonError(404, "Deal not found");

    const provider = await getProviderForOrg(user.organizationId);
    await runInvestigation({ organizationId: user.organizationId, provider, graph8DealId: deal.graph8DealId });

    const refreshed = await getDealOr404(user.organizationId, params.dealId);
    return NextResponse.json(await serializeDealDetail(refreshed!));
  });
}
