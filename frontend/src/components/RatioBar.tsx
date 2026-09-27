/**
 * Small won/lost meter — reuses the app's existing status colors (emerald = won,
 * rose = lost, from OutcomeBadge) rather than introducing a new categorical
 * palette. Direct-labeled, no hover needed: both counts are already visible text.
 */
export function RatioBar({ lostCount, wonCount }: { lostCount: number; wonCount: number }) {
  const total = lostCount + wonCount;
  const lostPct = total > 0 ? (lostCount / total) * 100 : 0;
  const wonPct = total > 0 ? (wonCount / total) * 100 : 0;

  return (
    <div>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {lostCount > 0 && (
          <div className="h-full rounded-full bg-rose-400" style={{ width: `${Math.max(lostPct, 4)}%` }} />
        )}
        {wonCount > 0 && (
          <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.max(wonPct, 4)}%` }} />
        )}
      </div>
      <div className="mt-1.5 flex gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          <span className="font-medium text-slate-700 dark:text-slate-200">{lostCount}</span> lost
        </span>
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="font-medium text-slate-700 dark:text-slate-200">{wonCount}</span> won
        </span>
      </div>
    </div>
  );
}
