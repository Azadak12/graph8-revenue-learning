/** Response shaping mirroring backend/app/schemas/api.py's Pydantic models —
 * converts Prisma rows (Decimal, Date, relations) into the exact JSON shape
 * the (unmodified) frontend already expects. */
import type {
  Pattern,
  PatternOccurrence,
  Recommendation,
  RecommendationAction,
  DealFactor,
  DealEvidence,
  DealAnalysis,
} from "@prisma/client";

export function serializePattern(p: Pattern) {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    segment_definition: p.segmentDefinition,
    lost_count: p.lostCount,
    won_count: p.wonCount,
    sample_size: p.sampleSize,
    pattern_strength: p.patternStrength,
    confidence: p.confidence,
    status: p.status,
    narrative: p.narrative,
    first_detected_at: p.firstDetectedAt.toISOString(),
    last_detected_at: p.lastDetectedAt.toISOString(),
  };
}

export function serializePatternOccurrence(o: PatternOccurrence) {
  return { deal_id: o.dealId, outcome: o.outcome };
}

export function serializePatternDetail(p: Pattern, occurrences: PatternOccurrence[]) {
  return { ...serializePattern(p), occurrences: occurrences.map(serializePatternOccurrence) };
}

export function serializeEvidence(e: DealEvidence) {
  return {
    id: e.id,
    source_type: e.sourceType,
    source_external_id: e.sourceExternalId,
    source_timestamp: e.sourceTimestamp ? e.sourceTimestamp.toISOString() : null,
    finding: e.finding,
    excerpt: e.excerpt,
    strength: e.strength,
  };
}

export function serializeFactor(f: DealFactor, evidence: DealEvidence[]) {
  return {
    id: f.id,
    category: f.category,
    specific_issue: f.specificIssue,
    factor_type: f.factorType,
    confidence: f.confidence,
    preventability: f.preventability,
    department: f.department,
    is_primary: f.isPrimary,
    evidence: evidence.map(serializeEvidence),
  };
}

export function serializeAnalysis(
  a: DealAnalysis,
  factors: Array<{ factor: DealFactor; evidence: DealEvidence[] }>
) {
  return {
    id: a.id,
    analysis_version: a.analysisVersion,
    outcome: a.outcome,
    summary: a.summary,
    confidence: a.confidence,
    human_confirmation_required: a.humanConfirmationRequired,
    status: a.status,
    completed_at: a.completedAt ? a.completedAt.toISOString() : null,
    factors: factors.map(({ factor, evidence }) => serializeFactor(factor, evidence)),
  };
}

export function serializeRecommendationAction(a: RecommendationAction) {
  return {
    id: a.id,
    action_type: a.actionType,
    status: a.status,
    graph8_object_type: a.graph8ObjectType,
    graph8_object_id: a.graph8ObjectId,
  };
}

export function serializeRecommendation(r: Recommendation, actions: RecommendationAction[]) {
  return {
    id: r.id,
    pattern_id: r.patternId,
    department: r.department,
    title: r.title,
    explanation: r.explanation,
    recommended_action: r.recommendedAction,
    priority: r.priority,
    status: r.status,
    actions: actions.map(serializeRecommendationAction),
  };
}
