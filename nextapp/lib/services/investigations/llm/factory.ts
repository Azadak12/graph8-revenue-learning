import { settings } from "../../../config";
import { AnthropicExtractor } from "./anthropicExtractor";
import { DeterministicDemoExtractor } from "./deterministicExtractor";
import type { DealExtractor } from "./types";

export function getExtractor(): DealExtractor {
  if (settings.anthropicApiKey) {
    return new AnthropicExtractor();
  }
  return new DeterministicDemoExtractor();
}
