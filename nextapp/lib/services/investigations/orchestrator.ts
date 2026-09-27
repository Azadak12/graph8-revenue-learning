/** Runs the full investigation pipeline for one closed deal. Ported from
 * backend/app/services/investigations/orchestrator.py.
 *
 * DEAL -> OUTCOME -> EVIDENCE -> FACTORS -> (persist) -> pattern refresh ->
 * recommendation refresh -> future-warning refresh. */
import { prisma } from "../../db";
import { settings } from "../../config";
import { getLogger } from "../../logging";
import type { DealAnalysis } from "@prisma/client";
import type { Graph8Provider } from "../graph8/base";
import { syncDeal } from "../graph8/sync";
import { buildEvidenceBundle } from "../evidence/normalize";
import { getExtractor } from "./llm/factory";
import { createClarificationTask } from "./clarification";
import { refreshPatternsForSegment } from "../patterns/engine";
import { refreshRecommendations } from "../recommendations/engine";
import { refreshFutureWarnings } from "../warnings/engine";

const logger = getLogger("orchestrator");

export async function runInvestigation(args: {
  organizationId: string;
  provider: Graph8Provider;
  graph8DealId: string;
  skipRefresh?: boolean;
}): Promise<DealAnalysis | null> {
  const { organizationId, provider, graph8DealId, skipRefresh } = args;
  const { deal } = await syncDeal({ organizationId, provider, graph8DealId });

  if (deal.outcome === "open") {
    logger.info("investigation_skipped_deal_still_open", { dealId: deal.id });
    return null;
  }

  // Re-fetch the bundle for evidence building (syncDeal already normalized+persisted stage/contacts).
  const g8Bundle = await provider.getDealBundle(graph8DealId);
  const evidenceBundle = buildEvidenceBundle(g8Bundle);
  const extractor = getExtractor(graph8DealId);

  await prisma.dealAnalysis.updateMany({
    where: { organizationId, dealId: deal.id, isCurrent: true },
    data: { isCurrent: false },
  });

  const priorVersion = await prisma.dealAnalysis.count({ where: { organizationId, dealId: deal.id } });

  let analysis = await prisma.dealAnalysis.create({
    data: {
      organizationId,
      dealId: deal.id,
      analysisVersion: priorVersion + 1,
      promptVersion: settings.analysisPromptVersion,
      modelIdentifier: extractor.modelIdentifier,
      taxonomyVersion: settings.taxonomyVersion,
      outcome: deal.outcome,
      summary: "",
      confidence: "unknown",
      status: "processing",
      isCurrent: true,
    },
  });

  let extraction;
  try {
    extraction = await extractor.extract(evidenceBundle, graph8DealId);
  } catch (err) {
    logger.exception("investigation_extraction_failed", err, { dealId: deal.id });
    analysis = await prisma.dealAnalysis.update({
      where: { id: analysis.id },
      data: { status: "failed", summary: "Analysis failed due to an internal error. It will be retried." },
    });
    return analysis;
  }

  const status = extraction.human_confirmation_required ? "needs_clarification" : "completed";
  analysis = await prisma.dealAnalysis.update({
    where: { id: analysis.id },
    data: {
      summary: extraction.summary,
      confidence: extraction.overall_confidence as any,
      humanConfirmationRequired: extraction.human_confirmation_required,
      status: status as any,
      completedAt: new Date(),
    },
  });

  const allExtracted: Array<[typeof extraction.primary_factor, boolean]> = [];
  if (extraction.primary_factor) allExtracted.push([extraction.primary_factor, true]);
  for (const f of extraction.secondary_factors) allExtracted.push([f, false]);

  let primaryFactorId: string | null = null;
  for (const [extracted, isPrimary] of allExtracted) {
    if (!extracted) continue;
    for (const department of extracted.departments) {
      const factor = await prisma.dealFactor.create({
        data: {
          organizationId,
          dealAnalysisId: analysis.id,
          category: extracted.category as any,
          specificIssue: extracted.specific_issue,
          factorType: isPrimary ? "primary" : "secondary",
          confidence: extracted.confidence as any,
          preventability: extracted.preventability as any,
          department: department as any,
          isPrimary,
        },
      });
      if (isPrimary && primaryFactorId === null) primaryFactorId = factor.id;

      for (const ev of extracted.evidence) {
        await prisma.dealEvidence.create({
          data: {
            organizationId,
            dealId: deal.id,
            analysisId: analysis.id,
            factorId: factor.id,
            sourceType: ev.source_type as any,
            sourceExternalId: ev.source_external_id,
            finding: ev.finding,
            excerpt: ev.excerpt,
            strength: ev.strength as any,
          },
        });
      }
    }
  }

  if (primaryFactorId) {
    analysis = await prisma.dealAnalysis.update({ where: { id: analysis.id }, data: { primaryFactorId } });
  }

  if (analysis.status === "needs_clarification") {
    try {
      const taskId = await createClarificationTask(provider, deal, analysis);
      await prisma.auditLog.create({
        data: {
          organizationId,
          action: "create_clarification_task",
          entityType: "deal_analysis",
          entityId: analysis.id,
          logMetadata: { graph8_task_id: taskId },
        },
      });
    } catch (err) {
      logger.exception("clarification_task_creation_failed", err, { dealId: deal.id });
    }
  }

  if (!skipRefresh) {
    await refreshPatternsForSegment({ organizationId, industry: deal.industry, segment: deal.segment });
    await refreshRecommendations({ organizationId });
    await refreshFutureWarnings({ organizationId, provider });
  }

  return analysis;
}
