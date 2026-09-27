export interface Evidence {
  id: string;
  source_type: string;
  source_external_id: string | null;
  source_timestamp?: string | null;
  finding: string;
  excerpt: string | null;
  strength: string;
}

export interface Factor {
  id: string;
  category: string;
  specific_issue: string;
  factor_type: string;
  confidence: string;
  preventability: string;
  department: string;
  is_primary: boolean;
  evidence: Evidence[];
}

export interface Analysis {
  id: string;
  analysis_version: number;
  outcome: string;
  summary: string;
  confidence: string;
  human_confirmation_required: boolean;
  status: string;
  completed_at: string | null;
  factors: Factor[];
}

export interface Contact {
  name: string;
  title: string | null;
  role: string;
  engaged_at: string | null;
}

export interface StageEvent {
  stage_name: string;
  entered_at: string;
  exited_at: string | null;
}

export interface Warning {
  id: string;
  pattern_id: string;
  explanation: string;
  similarity_basis: Record<string, unknown>;
  status: string;
}

export interface DealListItem {
  id: string;
  name: string;
  company_name: string;
  industry: string;
  segment: string;
  amount: number;
  currency: string;
  outcome: string;
  closed_at: string | null;
  analysis_status: string | null;
  primary_factor_category: string | null;
  confidence: string | null;
}

export interface DealDetail {
  id: string;
  name: string;
  company_name: string;
  industry: string;
  segment: string;
  amount: number;
  currency: string;
  outcome: string;
  stage_name: string | null;
  owner_name: string | null;
  opened_at: string | null;
  closed_at: string | null;
  contacts: Contact[];
  stage_history: StageEvent[];
  analysis: Analysis | null;
  warnings: Warning[];
}

export interface Pattern {
  id: string;
  name: string;
  category: string;
  segment_definition: Record<string, string>;
  lost_count: number;
  won_count: number;
  sample_size: number;
  pattern_strength: string;
  confidence: string;
  status: string;
  narrative: string;
  first_detected_at: string;
  last_detected_at: string;
}

export interface RecommendationAction {
  id: string;
  action_type: string;
  status: string;
  graph8_object_type: string | null;
  graph8_object_id: string | null;
}

export interface Recommendation {
  id: string;
  pattern_id: string;
  department: string;
  title: string;
  explanation: string;
  recommended_action: string;
  priority: string;
  status: string;
  actions: RecommendationAction[];
}

export interface CoachingItem {
  category: string;
  issue_examples: string[];
  deal_count: number;
  deals: { id: string; company_name: string }[];
  recurring: boolean;
}

export interface RepPerformance {
  owner_name: string;
  total_deals: number;
  won: number;
  lost: number;
  win_rate: number | null;
  coaching_items: CoachingItem[];
}

export interface OverviewSummary {
  total_deals_analyzed: number;
  won_count: number;
  lost_count: number;
  awaiting_clarification: number;
  executive_summary: string[];
  emerging_patterns: Pattern[];
  focus_areas: string[];
  recent_learnings: string[];
}
