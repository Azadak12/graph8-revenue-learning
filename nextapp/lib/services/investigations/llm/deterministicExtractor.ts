/** Fallback extractor used when ANTHROPIC_API_KEY is not configured. Ported
 * from backend/app/services/investigations/llm/deterministic_extractor.py. */
import type { DealEvidenceBundle } from "../../evidence/normalize";
import { groundTruthFor } from "../../graph8/demoProvider";
import type { DealAnalysisExtraction, DealExtractor, ExtractedEvidence, ExtractedFactor } from "./types";

function buildFactor(raw: any, bundle: DealEvidenceBundle): ExtractedFactor {
  const evidence: ExtractedEvidence[] = [];
  for (const finding of bundle.meeting_findings.slice(0, 3)) {
    evidence.push({
      source_type: finding.summary.startsWith("[internal note]") ? "note" : "meeting",
      source_external_id: finding.source_external_id,
      finding: finding.summary.slice(0, 200),
      excerpt: finding.summary.slice(0, 280),
      strength: raw.confidence === "high" ? "strong" : "moderate",
    });
  }
  return {
    category: raw.category,
    specific_issue: raw.specific_issue,
    confidence: raw.confidence,
    preventability: raw.preventability,
    departments: raw.departments,
    evidence,
  };
}

export class DeterministicDemoExtractor implements DealExtractor {
  modelIdentifier = "deterministic-demo-v1";

  async extract(bundle: DealEvidenceBundle, graph8DealId?: string | null): Promise<DealAnalysisExtraction> {
    const gt = groundTruthFor(graph8DealId || "");
    if (!gt) {
      return {
        outcome: bundle.deal_context.outcome,
        summary:
          "We don't have enough evidence to confidently determine what drove this " +
          "outcome. No pre-analyzed reference data was found for this deal.",
        primary_factor: null,
        secondary_factors: [],
        overall_confidence: "unknown",
        human_confirmation_required: true,
        unknowns: ["What was the main reason for this outcome?"],
      };
    }

    const primary = gt.primary_factor ? buildFactor(gt.primary_factor, bundle) : null;
    const secondary = (gt.secondary_factors || []).map((f) => buildFactor(f, bundle));

    const summaryParts: string[] = [];
    if (bundle.deal_context.outcome === "won" && gt.success_factors) {
      summaryParts.push(
        `${bundle.deal_context.company_name} closed won. Contributing factors appear to include: ` +
          gt.success_factors.join("; ") +
          "."
      );
    } else if (primary) {
      summaryParts.push(
        `${bundle.deal_context.company_name} appears to have been lost primarily due to ` +
          `${primary.specific_issue.toLowerCase()}.`
      );
      if (secondary.length > 0) {
        summaryParts.push(
          "Contributing factors may also include: " + secondary.map((f) => f.specific_issue).join("; ") + "."
        );
      }
    } else {
      summaryParts.push(
        "We don't have enough evidence to confidently determine why this deal closed the way it did."
      );
    }

    return {
      outcome: bundle.deal_context.outcome,
      summary: summaryParts.join(" "),
      primary_factor: primary,
      secondary_factors: secondary,
      overall_confidence: gt.overall_confidence,
      human_confirmation_required: gt.human_confirmation_required,
      unknowns: gt.unknowns || [],
    };
  }
}
