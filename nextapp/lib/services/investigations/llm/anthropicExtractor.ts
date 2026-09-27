/** Real LLM extraction via the Anthropic API using tool-use to force strict
 * structured output. Ported from
 * backend/app/services/investigations/llm/anthropic_extractor.py. */
import Anthropic from "@anthropic-ai/sdk";
import { settings } from "../../../config";
import { getLogger } from "../../../logging";
import { DEPARTMENTS, FACTOR_CATEGORIES } from "./types";
import type { DealAnalysisExtraction, DealExtractor } from "./types";

const logger = getLogger("anthropicExtractor");

const SYSTEM_PROMPT =
  "You are the Revenue Learning analysis engine for Graph8. You turn the " +
  "evidence for one CLOSED deal (won or lost) into a strictly factual, evidence-grounded " +
  "structured analysis.\n\n" +
  "Rules you must follow:\n" +
  "- Every factor you name must be grounded in the evidence provided. Do not invent facts.\n" +
  "- Never claim certainty beyond the evidence. Use hedged language: \"appears to have\", " +
  "\"was associated with\", \"may have contributed\", \"worth investigating\". Never say a factor " +
  "\"definitely caused\" the outcome.\n" +
  "- If evidence is thin or ambiguous, set overall_confidence to \"low\" or \"unknown\", leave " +
  "primary_factor null if you cannot responsibly name one, and set " +
  "human_confirmation_required to true. Returning \"unknown\" is a GOOD outcome when evidence " +
  "is insufficient — do not force a conclusion.\n" +
  "- If the evidence points to a buyer-side event unrelated to the seller's execution (e.g. a " +
  "budget freeze, internal reorg, project cancellation), name that plainly and mark " +
  "preventability as \"not_preventable\" — do not blame the sales team for it.\n" +
  "- category must be one of: " + FACTOR_CATEGORIES.join(", ") + "\n" +
  "- departments must be drawn from: " + DEPARTMENTS.join(", ") + "\n" +
  "- You MUST call the record_deal_analysis tool exactly once with your findings.";

const EVIDENCE_SCHEMA = {
  type: "object",
  properties: {
    source_type: {
      type: "string",
      enum: ["meeting", "transcript", "deal_activity", "note", "close_reason", "stakeholder_data", "salesperson_confirmation", "other"],
    },
    source_external_id: { type: ["string", "null"] },
    finding: { type: "string" },
    excerpt: { type: ["string", "null"] },
    strength: { type: "string", enum: ["weak", "moderate", "strong"] },
  },
  required: ["source_type", "finding", "strength"],
};

const FACTOR_SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string", enum: FACTOR_CATEGORIES as unknown as string[] },
    specific_issue: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low", "unknown"] },
    preventability: { type: "string", enum: ["preventable", "potentially_preventable", "not_preventable", "unknown"] },
    departments: { type: "array", items: { type: "string", enum: DEPARTMENTS as unknown as string[] }, minItems: 1 },
    evidence: { type: "array", items: EVIDENCE_SCHEMA },
  },
  required: ["category", "specific_issue", "confidence", "preventability", "departments"],
};

const TOOL_SCHEMA = {
  name: "record_deal_analysis",
  description: "Record the structured analysis for this closed deal.",
  input_schema: {
    type: "object" as const,
    properties: {
      outcome: { type: "string" },
      summary: { type: "string" },
      primary_factor: { anyOf: [FACTOR_SCHEMA, { type: "null" }] },
      secondary_factors: { type: "array", items: FACTOR_SCHEMA, maxItems: 4 },
      overall_confidence: { type: "string", enum: ["high", "medium", "low", "unknown"] },
      human_confirmation_required: { type: "boolean" },
      unknowns: { type: "array", items: { type: "string" } },
    },
    required: ["outcome", "summary", "overall_confidence", "human_confirmation_required"],
  },
};

export class AnthropicExtractor implements DealExtractor {
  modelIdentifier: string;
  private client: Anthropic;

  constructor() {
    this.modelIdentifier = settings.llmModel;
    this.client = new Anthropic({ apiKey: settings.anthropicApiKey! });
  }

  async extract(bundle: unknown, graph8DealId?: string | null): Promise<DealAnalysisExtraction> {
    const userContent = "Analyze this closed deal. Evidence bundle (already normalized, JSON):\n\n" + JSON.stringify(bundle, null, 2);

    const response = await this.client.messages.create({
      model: this.modelIdentifier,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: "tool", name: "record_deal_analysis" },
      messages: [{ role: "user", content: userContent }],
    });

    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === "record_deal_analysis") {
        return block.input as DealAnalysisExtraction;
      }
    }

    logger.error("anthropic_extraction_no_tool_call", { graph8DealId });
    throw new Error("Model did not return a structured tool call");
  }
}
