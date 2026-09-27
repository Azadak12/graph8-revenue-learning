/** Shared deal-lookup + detail-shaping helpers used by the deals API routes,
 * mirroring backend/app/api/routers/deals.py. */
import { prisma } from "../db";
import { serializeAnalysis } from "./serialize";
import type { Deal } from "@prisma/client";

export async function getDealOr404(organizationId: string, dealId: string): Promise<Deal | null> {
  const deal = await prisma.deal.findUnique({ where: { id: dealId } });
  if (!deal || deal.organizationId !== organizationId) return null;
  return deal;
}

export async function serializeDealDetail(deal: Deal) {
  const analysis = await prisma.dealAnalysis.findFirst({ where: { dealId: deal.id, isCurrent: true } });
  const warnings = await prisma.futureDealWarning.findMany({ where: { dealId: deal.id } });
  const stageHistory = await prisma.dealSnapshot.findMany({
    where: { dealId: deal.id },
    orderBy: { enteredAt: "asc" },
  });
  const contacts = await prisma.dealContact.findMany({ where: { dealId: deal.id } });

  let analysisOut = null;
  if (analysis) {
    const factors = await prisma.dealFactor.findMany({ where: { dealAnalysisId: analysis.id } });
    const factorsWithEvidence = await Promise.all(
      factors.map(async (factor) => ({
        factor,
        evidence: await prisma.dealEvidence.findMany({ where: { factorId: factor.id } }),
      }))
    );
    analysisOut = serializeAnalysis(analysis, factorsWithEvidence);
  }

  return {
    id: deal.id,
    name: deal.name,
    company_name: deal.companyName,
    industry: deal.industry,
    segment: deal.segment,
    amount: Number(deal.amount),
    currency: deal.currency,
    outcome: deal.outcome,
    stage_name: deal.stageName,
    owner_name: deal.ownerName,
    opened_at: deal.openedAt ? deal.openedAt.toISOString() : null,
    closed_at: deal.closedAt ? deal.closedAt.toISOString() : null,
    contacts: contacts.map((c) => ({
      name: c.name,
      title: c.title,
      role: c.role,
      engaged_at: c.engagedAt ? c.engagedAt.toISOString() : null,
    })),
    stage_history: stageHistory.map((s) => ({
      stage_name: s.stageName,
      entered_at: s.enteredAt.toISOString(),
      exited_at: s.exitedAt ? s.exitedAt.toISOString() : null,
    })),
    analysis: analysisOut,
    warnings: warnings.map((w) => ({
      id: w.id,
      pattern_id: w.patternId,
      explanation: w.explanation,
      similarity_basis: w.similarityBasis,
      status: w.status,
    })),
  };
}
