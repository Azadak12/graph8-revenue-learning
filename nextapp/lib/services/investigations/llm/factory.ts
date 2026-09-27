import { settings } from "../../../config";
import { AnthropicExtractor } from "./anthropicExtractor";
import { DeterministicDemoExtractor } from "./deterministicExtractor";
import { NotesEvidenceExtractor } from "./notesExtractor";
import type { DealExtractor } from "./types";

/** Claude reads the evidence when ANTHROPIC_API_KEY is set. Without it, demo
 * deals use their pre-analyzed reference data and live Graph8 deals are read
 * by the rule-based notes extractor. */
export function getExtractor(graph8DealId?: string | null): DealExtractor {
  if (settings.anthropicApiKey) {
    return new AnthropicExtractor();
  }
  if (graph8DealId?.startsWith("demo-")) {
    return new DeterministicDemoExtractor();
  }
  return new NotesEvidenceExtractor();
}
