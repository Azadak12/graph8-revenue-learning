/** Seeded DEMO DATA, ported verbatim (via JSON export) from
 * backend/app/seed/demo_deals.py. See that file for the full narrative
 * rationale on what patterns this data intentionally encodes. */
import raw from "./demoDealsData.json";

export interface RawDemoDeal {
  external_id: string;
  name: string;
  company_name: string;
  industry: string;
  segment: string;
  amount: number;
  currency: string;
  outcome: string;
  owner_name?: string;
  opened_days_ago?: number;
  closed_days_ago?: number;
  stage_history?: Array<[string, number, number | null]>;
  contacts?: Array<[string, string | null, string, number | null]>;
  meetings?: Array<[number, string]>;
  notes?: Array<[number, string]>;
  objections?: string[];
  requirements?: string[];
  competitors?: string[];
  pricing_notes?: string[];
  close_reason_raw?: string;
  ground_truth?: {
    primary_factor?: {
      category: string;
      specific_issue: string;
      confidence: string;
      preventability: string;
      departments: string[];
    };
    secondary_factors?: Array<{
      category: string;
      specific_issue: string;
      confidence: string;
      preventability: string;
      departments: string[];
    }>;
    success_factors?: string[];
    overall_confidence: string;
    human_confirmation_required: boolean;
    unknowns?: string[];
  };
}

export const CLOSED_DEALS = raw.closed as unknown as RawDemoDeal[];
export const ACTIVE_DEALS = raw.active as unknown as RawDemoDeal[];
