import type { ConfidenceLevel, PatternStrength } from "@prisma/client";
import { settings } from "../../config";

const DISPROPORTIONALITY_THRESHOLD = 0.25;

export function isDisproportionate(
  rateLost: number,
  wonWithFactor: number,
  lostWithFactor: number
): boolean {
  if (wonWithFactor === 0 && lostWithFactor >= 2) return true;
  return rateLost >= DISPROPORTIONALITY_THRESHOLD;
}

export function computeStrength(args: {
  lostWithFactor: number;
  wonWithFactor: number;
  totalLost: number;
  totalWon: number;
}): { strength: PatternStrength; confidence: ConfidenceLevel } | null {
  const { lostWithFactor, wonWithFactor, totalLost, totalWon } = args;
  if (lostWithFactor === 0) return null;

  const sampleSize = totalLost + totalWon;
  if (sampleSize < settings.patternMinSampleSize) return null;

  const rateLost = totalLost ? lostWithFactor / totalLost : 0;
  const rateWon = totalWon ? wonWithFactor / totalWon : 0;
  const disproportion = rateLost - rateWon;

  if (lostWithFactor === 1) {
    return { strength: "one_off", confidence: "low" };
  }

  if (!isDisproportionate(disproportion, wonWithFactor, lostWithFactor)) {
    return { strength: "one_off", confidence: "low" };
  }

  if (lostWithFactor >= settings.patternStrongThreshold) {
    return { strength: "strong_pattern", confidence: "high" };
  }
  if (lostWithFactor >= settings.patternRecurringThreshold) {
    return { strength: "recurring_pattern", confidence: "high" };
  }
  return { strength: "emerging_pattern", confidence: "medium" };
}
