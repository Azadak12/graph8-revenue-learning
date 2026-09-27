/** Rule-based extractor for live Graph8 deals when no ANTHROPIC_API_KEY is
 * configured. It reads the deal's own meeting summaries, notes and close
 * reason from Graph8, and names a factor only when the text states it,
 * quoting the matching lines as evidence. With an Anthropic key, the
 * AnthropicExtractor is used instead. */
import type { DealEvidenceBundle } from "../../evidence/normalize";
import type { DealAnalysisExtraction, DealExtractor, ExtractedEvidence, ExtractedFactor } from "./types";

interface Rule {
  category: string;
  issue: string;
  departments: string[];
  preventability: string;
  pattern: RegExp;
  /** Extra wording a line must also contain (e.g. that something is missing). */
  requires?: RegExp;
}

// Ordered by priority: the first rule that matches becomes the primary factor.
// A buyer-side freeze comes first so the seller isn't blamed for it.
const LOSS_RULES: Rule[] = [
  {
    category: "buyer_project_cancelled",
    issue: "Buyer-side freeze or cancellation unrelated to product fit",
    departments: ["leadership"],
    preventability: "not_preventable",
    pattern: /spending freeze|budget freeze|hiring freeze|project (was )?cancel|reorg|earnings|put on hold/i,
  },
  {
    category: "product_capability_gap",
    issue: "SCIM / automated user provisioning not supported",
    departments: ["product", "security", "sales_engineering"],
    preventability: "potentially_preventable",
    pattern: /\bscim\b|automated (user )?provisioning|manual provisioning|deprovisioning/i,
    requires: /\bnot\b|\bno\b|lack|without|missing|unsupported|blocker|gap|manual|required|mandatory|fail/i,
  },
  {
    category: "proposal_delay",
    issue: "Proposal delayed by internal approval backlog",
    departments: ["sales", "operations"],
    preventability: "preventable",
    pattern: /proposal (was )?(sent )?\d* ?days? late|proposal (was )?(delayed|stuck)|approval backlog|stuck in (manager )?review/i,
  },
  {
    category: "packaging",
    issue: "Rigid packaging or contract terms did not fit the buyer",
    departments: ["pricing", "product"],
    preventability: "potentially_preventable",
    pattern: /[àa] la carte|modular|only (wanted|needed) (one|a single)|full[- ]suite|bundle|annual[- ]only|contract term/i,
  },
  {
    category: "pricing",
    issue: "Price above the buyer's budget",
    departments: ["pricing", "sales"],
    preventability: "potentially_preventable",
    pattern: /above (their |the buyer'?s )?budget|too expensive|price (was )?too high|\d+% above|over budget|cheaper/i,
  },
  {
    category: "competitor",
    issue: "Lost to a competitor",
    departments: ["product", "sales"],
    preventability: "potentially_preventable",
    pattern: /lost to|selected a competitor|signed with a competitor|chose (a |another )?(competitor|vendor)|went with|vertical specialist/i,
  },
  {
    category: "missing_decision_maker",
    issue: "Decision maker engaged late in the cycle",
    departments: ["sales"],
    preventability: "preventable",
    pattern: /joined for the first time|joined (only )?late|only joined|never (met|engaged)|no (economic buyer|decision maker)/i,
  },
];

const WIN_SIGNALS: RegExp =
  /engaged (from|early|within)|champion|\broi\b|\btco\b|same[- ]day|confirmed .*early|surfaced .*early|early in (discovery|the evaluation)|modular|quarterly term|matched .* to|addressed every|differentiat|momentum|implementation speed/i;

function lines(bundle: DealEvidenceBundle): Array<{ id: string | null; text: string; type: string }> {
  const out: Array<{ id: string | null; text: string; type: string }> = [];
  for (const f of bundle.meeting_findings) {
    const isNote = f.summary.startsWith("[internal note]");
    out.push({ id: f.source_external_id, text: f.summary.replace(/^\[internal note\]\s*/, ""), type: isNote ? "note" : "meeting" });
  }
  if (bundle.close_context.close_reason_raw) {
    out.push({ id: null, text: bundle.close_context.close_reason_raw, type: "close_reason" });
  }
  return out.filter((l) => l.text.trim());
}

function factorFor(rule: Rule, matches: ReturnType<typeof lines>): ExtractedFactor {
  const evidence: ExtractedEvidence[] = matches.slice(0, 3).map((m) => ({
    source_type: m.type,
    source_external_id: m.id,
    finding: m.text.slice(0, 200),
    excerpt: m.text.slice(0, 280),
    strength: matches.length >= 2 ? "strong" : "moderate",
  }));
  return {
    category: rule.category,
    specific_issue: rule.issue,
    confidence: matches.length >= 2 ? "high" : "medium",
    preventability: rule.preventability,
    departments: rule.departments,
    evidence,
  };
}

export class NotesEvidenceExtractor implements DealExtractor {
  modelIdentifier = "graph8-notes-rules-v1";

  async extract(bundle: DealEvidenceBundle): Promise<DealAnalysisExtraction> {
    const all = lines(bundle);
    const company = bundle.deal_context.company_name || bundle.deal_context.deal_name || "This deal";

    if (bundle.deal_context.outcome === "won") {
      const wins = all.filter((l) => WIN_SIGNALS.test(l.text)).slice(0, 3);
      return {
        outcome: "won",
        summary: wins.length
          ? `${company} closed won. From the Graph8 notes, contributing factors appear to include: ${wins.map((w) => w.text).join(" ")}`
          : `${company} closed won. The Graph8 notes don't state clearly what drove the win.`,
        primary_factor: null,
        secondary_factors: [],
        overall_confidence: wins.length ? "medium" : "low",
        human_confirmation_required: wins.length === 0,
        unknowns: wins.length ? [] : ["What was the main reason this deal was won?"],
      };
    }

    const factors: ExtractedFactor[] = [];
    for (const rule of LOSS_RULES) {
      const matches = all.filter((l) => rule.pattern.test(l.text) && (!rule.requires || rule.requires.test(l.text)));
      if (matches.length) factors.push(factorFor(rule, matches));
    }

    if (factors.length === 0) {
      return {
        outcome: bundle.deal_context.outcome,
        summary:
          `We don't have enough evidence in the Graph8 notes to say why ${company} was lost. ` +
          "Ask the rep to confirm the main reason.",
        primary_factor: null,
        secondary_factors: [],
        overall_confidence: "unknown",
        human_confirmation_required: true,
        unknowns: ["What was the main reason for this outcome?"],
      };
    }

    const [primary, ...secondary] = factors;
    const parts = [`${company} appears to have been lost primarily due to ${primary.specific_issue.toLowerCase()}.`];
    if (secondary.length) parts.push(`Contributing factors may also include: ${secondary.map((f) => f.specific_issue.toLowerCase()).join("; ")}.`);
    return {
      outcome: bundle.deal_context.outcome,
      summary: parts.join(" "),
      primary_factor: primary,
      secondary_factors: secondary.slice(0, 3),
      overall_confidence: primary.confidence,
      human_confirmation_required: false,
      unknowns: [],
    };
  }
}
