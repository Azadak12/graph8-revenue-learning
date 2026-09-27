import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { Pattern } from "../../types";
import { Card } from "../../components/Card";
import { ConfidenceBadge } from "../../components/ConfidenceBadge";
import { RatioBar } from "../../components/RatioBar";
import { PATTERN_STRENGTH_ORDER, PatternStrengthBadge } from "../../components/PatternStrengthBadge";

export function LearningsPage() {
  const [patterns, setPatterns] = useState<Pattern[] | null>(null);
  const [segmentFilter, setSegmentFilter] = useState("all");

  useEffect(() => {
    api.get<Pattern[]>("/api/learnings").then(setPatterns);
  }, []);

  const segments = useMemo(() => {
    if (!patterns) return [];
    return Array.from(new Set(patterns.map((p) => p.segment_definition.segment).filter(Boolean)));
  }, [patterns]);

  const filtered = useMemo(() => {
    if (!patterns) return null;
    const list =
      segmentFilter === "all" ? patterns : patterns.filter((p) => p.segment_definition.segment === segmentFilter);
    return [...list].sort(
      (a, b) => PATTERN_STRENGTH_ORDER[a.pattern_strength] - PATTERN_STRENGTH_ORDER[b.pattern_strength]
    );
  }, [patterns, segmentFilter]);

  return (
    <div className="max-w-4xl">
      <h1 className="mb-1 text-2xl font-semibold text-ink dark:text-slate-100">Learnings</h1>
      <p className="mb-6 text-slate-500 dark:text-slate-400">
        Organizational patterns detected by comparing won and lost deals — the organizational intelligence
        center.
      </p>

      {segments.length > 1 && (
        <div className="mb-6 flex w-fit flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            onClick={() => setSegmentFilter("all")}
            className={`rounded-md px-3 py-1 text-sm font-medium ${
              segmentFilter === "all"
                ? "bg-white text-ink shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            All segments
          </button>
          {segments.map((s) => (
            <button
              key={s}
              onClick={() => setSegmentFilter(s)}
              className={`rounded-md px-3 py-1 text-sm font-medium capitalize ${
                segmentFilter === s
                  ? "bg-white text-ink shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {s.replace("_", "-")}
            </button>
          ))}
        </div>
      )}

      {!patterns ? (
        <div className="text-slate-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {filtered?.map((p) => (
            <Link key={p.id} to={`/learnings/${p.id}`} className="block">
              <Card className="transition hover:border-indigo-200 hover:shadow-md dark:hover:border-indigo-800">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <PatternStrengthBadge strength={p.pattern_strength} />
                  <ConfidenceBadge confidence={p.confidence} />
                </div>
                <div className="mb-1 font-medium text-ink dark:text-slate-100">{p.name}</div>
                <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{p.narrative}</p>
                <RatioBar lostCount={p.lost_count} wonCount={p.won_count} />
              </Card>
            </Link>
          ))}
          {filtered?.length === 0 && (
            <Card className="text-sm text-slate-500 dark:text-slate-400">
              No patterns detected yet — analyze more closed deals.
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
