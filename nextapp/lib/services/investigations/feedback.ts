/** Applies salesperson clarification / correction to an existing DealAnalysis.
 * Ported from backend/app/services/investigations/feedback.py. */
import { prisma } from "../../db";
import { refreshPatternsForSegment } from "../patterns/engine";
import { refreshRecommendations } from "../recommendations/engine";
import type { Deal, DealAnalysis, FactorCategory, HumanFeedback } from "@prisma/client";

const REASON_TO_CATEGORY: Record<string, FactorCategory> = {
  pricing: "pricing",
  missing_capability: "product_capability_gap",
  competitor: "competitor",
  security_compliance: "security",
  budget_timing: "budget",
  buyer_cancelled_internally: "buyer_project_cancelled",
  stakeholder_issue: "stakeholder_misalignment",
  other: "other",
};

export async function submitFeedback(args: {
  organizationId: string;
  deal: Deal;
  analysis: DealAnalysis;
  userId: string | null;
  feedbackType: string;
  selectedReason: string | null;
  overrideCategory: string | null;
  wasSellerControllable: boolean | null;
  anotherVendorSelected: boolean | null;
  comment: string | null;
}): Promise<HumanFeedback> {
  const { organizationId, deal, analysis, userId, feedbackType, selectedReason, overrideCategory, wasSellerControllable, anotherVendorSelected, comment } = args;

  let resolvedCategory: FactorCategory | null = null;
  if (overrideCategory) {
    resolvedCategory = overrideCategory as FactorCategory;
  } else if (selectedReason && REASON_TO_CATEGORY[selectedReason]) {
    resolvedCategory = REASON_TO_CATEGORY[selectedReason];
  }

  const feedback = await prisma.humanFeedback.create({
    data: {
      organizationId,
      dealId: deal.id,
      analysisId: analysis.id,
      userId,
      feedbackType,
      selectedReason,
      overrideCategory: resolvedCategory,
      wasSellerControllable,
      anotherVendorSelected,
      comment,
    },
  });

  if (analysis.status === "needs_clarification") {
    const updatedSummary =
      resolvedCategory && (!analysis.summary || analysis.confidence === "unknown")
        ? `${analysis.summary} Updated after rep clarification: ${comment || selectedReason || ""}`.trim()
        : analysis.summary;
    await prisma.dealAnalysis.update({
      where: { id: analysis.id },
      data: {
        status: "completed",
        confidence: "medium",
        humanConfirmationRequired: false,
        summary: updatedSummary,
      },
    });
  }

  await refreshPatternsForSegment({ organizationId, industry: deal.industry, segment: deal.segment });
  await refreshRecommendations({ organizationId });

  return feedback;
}
