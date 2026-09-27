import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth";
import { withErrorHandling } from "../../../lib/apiHelpers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const { searchParams } = new URL(request.url);
    const outcome = searchParams.get("outcome");
    const segment = searchParams.get("segment");
    const industry = searchParams.get("industry");

    const deals = await prisma.deal.findMany({
      where: {
        organizationId: user.organizationId,
        ...(outcome ? { outcome: outcome as any } : {}),
        ...(segment ? { segment: segment as any } : {}),
        ...(industry ? { industry } : {}),
      },
      orderBy: { closedAt: { sort: "desc", nulls: "last" } },
    });

    const items = [];
    for (const deal of deals) {
      const analysis = await prisma.dealAnalysis.findFirst({
        where: { dealId: deal.id, isCurrent: true },
      });
      let primaryCategory: string | null = null;
      if (analysis?.primaryFactorId) {
        const factor = await prisma.dealFactor.findUnique({ where: { id: analysis.primaryFactorId } });
        primaryCategory = factor?.category || null;
      }
      items.push({
        id: deal.id,
        name: deal.name,
        company_name: deal.companyName,
        industry: deal.industry,
        segment: deal.segment,
        amount: Number(deal.amount),
        currency: deal.currency,
        outcome: deal.outcome,
        closed_at: deal.closedAt ? deal.closedAt.toISOString() : null,
        analysis_status: analysis?.status || null,
        primary_factor_category: primaryCategory,
        confidence: analysis?.confidence || null,
      });
    }
    return NextResponse.json(items);
  });
}
