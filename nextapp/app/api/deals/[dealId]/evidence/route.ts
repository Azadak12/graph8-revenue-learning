import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";
import { jsonError, withErrorHandling } from "../../../../../lib/apiHelpers";
import { getDealOr404 } from "../../../../../lib/services/deals";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { dealId: string } }) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const deal = await getDealOr404(user.organizationId, params.dealId);
    if (!deal) return jsonError(404, "Deal not found");
    const evidence = await prisma.dealEvidence.findMany({ where: { dealId: deal.id } });
    return NextResponse.json(
      evidence.map((e) => ({
        id: e.id,
        source_type: e.sourceType,
        source_external_id: e.sourceExternalId,
        finding: e.finding,
        excerpt: e.excerpt,
        strength: e.strength,
      }))
    );
  });
}
