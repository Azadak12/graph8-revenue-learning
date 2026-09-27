import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "../../../../lib/auth";
import { jsonError, withErrorHandling } from "../../../../lib/apiHelpers";
import { getDealOr404, serializeDealDetail } from "../../../../lib/services/deals";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { dealId: string } }) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const deal = await getDealOr404(user.organizationId, params.dealId);
    if (!deal) return jsonError(404, "Deal not found");
    return NextResponse.json(await serializeDealDetail(deal));
  });
}
