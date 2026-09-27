import type { StageEvent } from "../types";

function daysBetween(start: string, end: string) {
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function StageTimeline({ stages, outcome }: { stages: StageEvent[]; outcome: string }) {
  if (stages.length === 0) return null;

  const sorted = [...stages].sort((a, b) => new Date(a.entered_at).getTime() - new Date(b.entered_at).getTime());
  const now = new Date().toISOString();
  const segments = sorted.map((s, i) => {
    const end = s.exited_at ?? sorted[i + 1]?.entered_at ?? now;
    return { ...s, days: daysBetween(s.entered_at, end), isLast: i === sorted.length - 1 };
  });
  const totalDays = segments.reduce((sum, s) => sum + s.days, 0);

  const finalColor = outcome === "won" ? "bg-emerald-400" : outcome === "lost" ? "bg-rose-400" : "bg-indigo-300";

  return (
    <div>
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full">
        {segments.map((s, i) => (
          <div
            key={i}
            style={{ width: `${Math.max((s.days / totalDays) * 100, 4)}%` }}
            className={`h-full rounded-full ${s.isLast ? finalColor : "bg-slate-300 dark:bg-slate-700"}`}
            title={`${s.stage_name}: ${s.days} day${s.days === 1 ? "" : "s"}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${s.isLast ? finalColor : "bg-slate-300 dark:bg-slate-700"}`}
            />
            <span className="font-medium text-slate-600 dark:text-slate-300">{s.stage_name}</span>
            <span>
              {s.days}d &middot; {formatDate(s.entered_at)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-1 text-xs text-slate-400">{totalDays} days total in pipeline</div>
    </div>
  );
}
