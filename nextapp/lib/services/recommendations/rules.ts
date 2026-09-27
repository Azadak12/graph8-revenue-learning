import type { Department } from "@prisma/client";

// Text uses {segment_label}; the engine fills it and adds the numbers, example
// deals and a quote from the notes of the deals behind each pattern.

interface Rule {
  department: Department;
  title: string;
  explanation: string;
  recommendedAction: string;
  priority: "high" | "medium" | "low";
}

export const RECOMMENDATION_RULES: Record<string, Rule[]> = {
  scim_provisioning: [
    {
      department: "product",
      title: "Evaluate SCIM / automated provisioning for {segment_label} accounts",
      explanation:
        "SCIM keeps appearing as a blocker in {segment_label} deals. It's worth evaluating " +
        "whether SCIM 2.0 support belongs on the near-term roadmap for this segment.",
      recommendedAction:
        "Assess SCIM 2.0 support against the roadmap and the vendor-review requirements seen in {segment_label} deals.",
      priority: "high",
    },
    {
      department: "sales_engineering",
      title: "Add identity-provisioning discovery earlier for {segment_label}",
      explanation:
        "In several lost deals, the provisioning/SCIM requirement wasn't raised until " +
        "technical evaluation or later, leaving no time to address it.",
      recommendedAction: "Add an identity-management / provisioning question to the standard technical discovery checklist.",
      priority: "medium",
    },
    {
      department: "sales",
      title: "Confirm provisioning expectations before technical evaluation ({segment_label})",
      explanation: "Confirming this early avoids investing a full cycle in a deal with an unresolvable technical gap.",
      recommendedAction: "Ask about SSO/SCIM and identity-provider requirements during discovery for {segment_label} prospects.",
      priority: "medium",
    },
  ],
  pricing_packaging: [
    {
      department: "pricing",
      title: "Introduce modular / tiered packaging for {segment_label}",
      explanation:
        "{segment_label} losses cluster around price and rigid packaging (full-suite-only " +
        "bundles, annual-only terms) that doesn't match buyer budgets or cycles.",
      recommendedAction: "Evaluate a modular or tiered package, and a monthly/quarterly billing option, for {segment_label} buyers.",
      priority: "high",
    },
    {
      department: "sales",
      title: "Qualify budget and economic buyer earlier in {segment_label} deals",
      explanation: "Budget and the economic buyer surfaced too late in these {segment_label} losses.",
      recommendedAction: "Add a budget/economic-buyer qualification step before sending a {segment_label} proposal.",
      priority: "medium",
    },
  ],
  missing_decision_maker: [
    {
      department: "sales",
      title: "Introduce decision-maker validation before Proposal ({segment_label})",
      explanation:
        "Won deals in this segment consistently had the economic/technical decision maker " +
        "engaged well before the Proposal stage; lost deals often didn't.",
      recommendedAction:
        "Require confirmation that the economic/technical decision maker has been identified and engaged before a deal can move to Proposal.",
      priority: "high",
    },
    {
      department: "leadership",
      title: "Add stakeholder coverage to {segment_label} deal inspection",
      explanation: "Deal reviews don't currently surface missing decision-maker engagement as a risk flag.",
      recommendedAction: "Add a stakeholder-coverage check (champion + economic buyer identified) to the standard deal-inspection review.",
      priority: "medium",
    },
  ],
  competitor: [
    {
      department: "product",
      title: "Review competitive differentiation for {segment_label}",
      explanation: "Competitive losses in this segment cite a specific capability gap relative to a named competitor.",
      recommendedAction: "Review the competitive comparison and assess whether a roadmap investment is warranted.",
      priority: "medium",
    },
    {
      department: "sales",
      title: "Surface the competitive landscape earlier in {segment_label} discovery",
      explanation: "Competitive evaluations were sometimes discovered late, leaving no time to differentiate.",
      recommendedAction: "Ask directly about parallel vendor evaluations during discovery.",
      priority: "low",
    },
  ],
  proposal_delay: [
    {
      department: "operations",
      title: "Reduce internal proposal turnaround time for {segment_label}",
      explanation: "Deals have been lost to competitors during internal proposal approval delays while buyer interest was highest.",
      recommendedAction: "Set an SLA for proposal approval turnaround and monitor deals that exceed it.",
      priority: "medium",
    },
  ],
};

/** Fills {placeholders} in a rule's text with values from the data. */
export function fillTemplate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

export function rulesForBucket(bucketKey: string): Rule[] {
  return RECOMMENDATION_RULES[bucketKey] || [];
}
