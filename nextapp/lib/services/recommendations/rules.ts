import type { Department } from "@prisma/client";

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
      title: "Evaluate SCIM / automated provisioning for enterprise accounts",
      explanation:
        "SCIM has repeatedly appeared as a blocker in enterprise financial-services " +
        "opportunities. It's worth evaluating whether SCIM 2.0 support belongs on the " +
        "near-term roadmap for this segment.",
      recommendedAction:
        "Assess SCIM 2.0 support against the enterprise roadmap and vendor-review requirements seen in this segment.",
      priority: "high",
    },
    {
      department: "sales_engineering",
      title: "Add identity-provisioning discovery earlier",
      explanation:
        "In several lost deals, the provisioning/SCIM requirement wasn't raised until " +
        "technical evaluation or later, leaving no time to address it.",
      recommendedAction: "Add an identity-management / provisioning question to the standard technical discovery checklist.",
      priority: "medium",
    },
    {
      department: "sales",
      title: "Confirm provisioning expectations before technical evaluation",
      explanation: "Confirming this early avoids investing a full cycle in a deal with an unresolvable technical gap.",
      recommendedAction: "Ask about SSO/SCIM and identity-provider requirements during discovery for enterprise financial-services prospects.",
      priority: "medium",
    },
  ],
  pricing_packaging: [
    {
      department: "pricing",
      title: "Introduce modular / tiered packaging for mid-market",
      explanation:
        "Mid-market losses cluster around rigid packaging (full-suite-only bundles, " +
        "annual-only terms) that doesn't match buyer budgets or cycles.",
      recommendedAction: "Evaluate a modular or tiered package, and a monthly/quarterly billing option, for the mid-market segment.",
      priority: "high",
    },
    {
      department: "sales",
      title: "Qualify budget and economic buyer earlier in mid-market deals",
      explanation: "Several mid-market losses had no economic buyer engaged before the pricing conversation happened.",
      recommendedAction: "Add a budget/economic-buyer qualification step before sending a mid-market proposal.",
      priority: "medium",
    },
  ],
  missing_decision_maker: [
    {
      department: "sales",
      title: "Introduce decision-maker validation before Proposal",
      explanation:
        "Won deals in this segment consistently had the economic/technical decision maker " +
        "engaged well before the Proposal stage; lost deals often didn't.",
      recommendedAction:
        "Require confirmation that the economic/technical decision maker has been identified and engaged before a deal can move to Proposal.",
      priority: "high",
    },
    {
      department: "leadership",
      title: "Add stakeholder coverage to deal inspection",
      explanation: "Deal reviews don't currently surface missing decision-maker engagement as a risk flag.",
      recommendedAction: "Add a stakeholder-coverage check (champion + economic buyer identified) to the standard deal-inspection review.",
      priority: "medium",
    },
  ],
  competitor: [
    {
      department: "product",
      title: "Review competitive differentiation for this segment",
      explanation: "Competitive losses in this segment cite a specific capability gap relative to a named competitor.",
      recommendedAction: "Review the competitive comparison and assess whether a roadmap investment is warranted.",
      priority: "medium",
    },
    {
      department: "sales",
      title: "Surface competitive landscape earlier in discovery",
      explanation: "Competitive evaluations were sometimes discovered late, leaving no time to differentiate.",
      recommendedAction: "Ask directly about parallel vendor evaluations during discovery.",
      priority: "low",
    },
  ],
  proposal_delay: [
    {
      department: "operations",
      title: "Reduce internal proposal turnaround time",
      explanation: "Deals have been lost to competitors during internal proposal approval delays while buyer interest was highest.",
      recommendedAction: "Set an SLA for proposal approval turnaround and monitor deals that exceed it.",
      priority: "medium",
    },
  ],
};

export function rulesForBucket(bucketKey: string): Rule[] {
  return RECOMMENDATION_RULES[bucketKey] || [];
}
