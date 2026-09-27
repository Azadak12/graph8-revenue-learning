/** Creates the Graph8 clarification task when an analysis needs human input.
 * Ported from backend/app/services/investigations/clarification.py. */
import type { Graph8Provider } from "../graph8/base";
import type { Deal, DealAnalysis } from "@prisma/client";

const CLARIFICATION_QUESTIONS = `1. What was the main reason? (Pricing / Missing capability / Competitor / Security-compliance / \
Budget-timing / Buyer cancelled internally / Stakeholder issue / Other)
2. Was another vendor selected? (Yes / No / Unknown)
3. Could we realistically have done something differently? (Yes / No / Unsure)
4. Optional comment.

Reply on this task with your answers, or use the "Correct analysis" action in Revenue Learning.`;

export async function createClarificationTask(
  provider: Graph8Provider,
  deal: Deal,
  analysis: DealAnalysis
): Promise<string> {
  const title =
    deal.outcome === "lost"
      ? "Help Revenue Learning understand why this deal was lost"
      : "Help Revenue Learning understand this deal's outcome";
  const description =
    "We couldn't confidently determine the primary reason from the available deal evidence.\n\n" +
    `Current summary: ${analysis.summary}\n\n` +
    "Please answer these short questions:\n\n" +
    CLARIFICATION_QUESTIONS;
  return provider.createTask({
    graph8DealId: deal.graph8DealId,
    title,
    description,
    assigneeHint: deal.ownerName,
  });
}
