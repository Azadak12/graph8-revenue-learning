const LABEL: Record<string, string> = {
  one_off: "One-off",
  emerging_pattern: "Emerging pattern",
  recurring_pattern: "Recurring pattern",
  strong_pattern: "Strong pattern",
};

const STYLE: Record<string, string> = {
  one_off: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  emerging_pattern: "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  recurring_pattern: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  strong_pattern: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export const PATTERN_STRENGTH_ORDER: Record<string, number> = {
  strong_pattern: 0,
  recurring_pattern: 1,
  emerging_pattern: 2,
  one_off: 3,
};

export function PatternStrengthBadge({ strength }: { strength: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLE[strength] ?? STYLE.one_off}`}>
      {LABEL[strength] ?? strength}
    </span>
  );
}
