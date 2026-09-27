/** Structured output contract for the AI extraction step, ported from
 * backend/app/schemas/llm_extraction.py. */

export const FACTOR_CATEGORIES = [
  "product_capability_gap", "integration_gap", "pricing", "packaging", "competitor", "security",
  "compliance", "privacy", "legal", "implementation", "support", "wrong_fit",
  "missing_decision_maker", "weak_champion", "stakeholder_misalignment", "poor_discovery",
  "poor_demo", "slow_followup", "proposal_delay", "communication", "value_not_proven",
  "roi_not_proven", "timing", "budget", "priority_change", "buyer_project_cancelled",
  "procurement", "internal_seller_delay", "unknown", "other",
] as const;

export const DEPARTMENTS = [
  "sales", "sales_engineering", "product", "engineering", "pricing", "finance", "security",
  "compliance", "privacy", "legal", "operations", "implementation", "leadership",
] as const;

export interface ExtractedEvidence {
  source_type: string;
  source_external_id?: string | null;
  finding: string;
  excerpt?: string | null;
  strength: string;
}

export interface ExtractedFactor {
  category: string;
  specific_issue: string;
  confidence: string;
  preventability: string;
  departments: string[];
  evidence: ExtractedEvidence[];
}

export interface DealAnalysisExtraction {
  outcome: string;
  summary: string;
  primary_factor: ExtractedFactor | null;
  secondary_factors: ExtractedFactor[];
  overall_confidence: string;
  human_confirmation_required: boolean;
  unknowns: string[];
}

export interface DealExtractor {
  modelIdentifier: string;
  extract(bundle: any, graph8DealId?: string | null): Promise<DealAnalysisExtraction>;
}
