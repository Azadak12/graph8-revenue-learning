import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import { getCurrentUser } from "../../../../../lib/auth";
import { jsonError, withErrorHandling } from "../../../../../lib/apiHelpers";
import { getDealOr404 } from "../../../../../lib/services/deals";
import { submitFeedback } from "../../../../../lib/services/investigations/feedback";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { dealId: string } }) {
  return withErrorHandling(async () => {
    const user = await getCurrentUser(request);
    const deal = await getDealOr404(user.organizationId, params.dealId);
    if (!deal) return jsonError(404, "Deal not found");

    const analysis = await prisma.dealAnalysis.findFirst({ where: { dealId: deal.id, isCurrent: true } });
    if (!analysis) return jsonError(404, "No analysis found for this deal");

    const payload = await request.json();
    const feedback = await submitFeedback({
      organizationId: user.organizationId,
      deal,
      analysis,
      userId: user.id,
      feedbackType: payload.feedback_type,
      selectedReason: payload.selected_reason ?? null,
      overrideCategory: payload.override_category ?? null,
      wasSellerControllable: payload.was_seller_controllable ?? null,
      anotherVendorSelected: payload.another_vendor_selected ?? null,
      comment: payload.comment ?? null,
    });

    return NextResponse.json({ id: feedback.id, status: "recorded" });
  });
}
