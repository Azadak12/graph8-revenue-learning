/** Groups DealFactor rows into human-legible "pattern buckets". See the
 * original Python module (backend/app/services/patterns/bucketing.py) for the
 * full rationale — ported here verbatim. */
import type { FactorCategory } from "@prisma/client";

interface BucketDefinition {
  name: string;
  grain: "industry_segment" | "segment";
  narrative: string;
}

export const BUCKET_DEFINITIONS: Record<string, BucketDefinition> = {
  scim_provisioning: {
    name: "SCIM / identity provisioning gap",
    grain: "industry_segment",
    narrative:
      "SCIM / automated identity-provisioning requirements have repeatedly appeared in lost " +
      "{industry} {segment} deals ({lost_count} of {total_lost} lost deals analyzed), and do not " +
      "appear as an issue in any of the {total_won} won deals in the same segment " +
      "({won_count} comparable wins).",
  },
  pricing_packaging: {
    name: "Pricing & packaging friction",
    grain: "segment",
    narrative:
      "Pricing or packaging friction (rigid bundles, list price above budget, inflexible contract " +
      "terms) appears in {lost_count} of {total_lost} lost {segment} deals analyzed, versus " +
      "{won_count} of {total_won} won {segment} deals.",
  },
  missing_decision_maker: {
    name: "Decision maker engaged late",
    grain: "segment",
    narrative:
      "Among {segment} deals, the economic/technical decision maker engaged only late in the " +
      "cycle (at or after the Proposal stage) or never at all in {lost_count} of {total_lost} lost " +
      "deals, versus {won_count} of {total_won} won deals.",
  },
  competitor: {
    name: "Competitive losses",
    grain: "industry_segment",
    narrative:
      "{lost_count} of {total_lost} lost {industry} {segment} deals cite a named competitor as the " +
      "deciding factor, versus {won_count} of {total_won} won deals.",
  },
  proposal_delay: {
    name: "Internal proposal delay",
    grain: "segment",
    narrative:
      "Internal delays getting a proposal out appear in {lost_count} of {total_lost} lost " +
      "{segment} deals analyzed, versus {won_count} of {total_won} won deals.",
  },
};

const DEFAULT_GRAIN = "industry_segment" as const;

export function bucketKeyForFactor(category: FactorCategory, specificIssue: string): string {
  const issueLower = specificIssue.toLowerCase();
  if (issueLower.includes("scim") || issueLower.includes("provisioning")) return "scim_provisioning";
  if (category === "pricing" || category === "packaging") return "pricing_packaging";
  if (category === "missing_decision_maker") return "missing_decision_maker";
  if (category === "competitor") return "competitor";
  if (category === "proposal_delay") return "proposal_delay";
  return category;
}

export function bucketDefinition(bucketKey: string): BucketDefinition {
  return (
    BUCKET_DEFINITIONS[bucketKey] || {
      name: bucketKey
        .split("_")
        .map((w) => w[0]?.toUpperCase() + w.slice(1))
        .join(" "),
      grain: DEFAULT_GRAIN,
      narrative:
        "{lost_count} of {total_lost} lost {industry} {segment} deals analyzed show this factor, " +
        "versus {won_count} of {total_won} won deals.",
    }
  );
}

export function formatNarrative(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}
