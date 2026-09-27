import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import type { Pattern, DealListItem } from "../../types";
import { Card, SectionLabel } from "../../components/Card";
import { ConfidenceBadge } from "../../components/ConfidenceBadge";
import { RatioBar } from "../../components/RatioBar";

interface PatternDetail extends Pattern {
  occurrences: { deal_id: string; outcome: string }[];
}

export function LearningDetailPage() {
  const { patternId } = useParams();
  const [pattern, setPattern] = useState<PatternDetail | null>(null);
  const [deals, setDeals] = useState<DealListItem[]>([]);

  useEffect(() => {
    if (patternId) api.get<PatternDetail>(`/api/learnings/${patternId}`).then(setPattern);
    api.get<DealListItem[]>("/api/deals").then(setDeals);
  }, [patternId]);

  if (!pattern) return <div className="text-slate-400">Loading...</div>;

  const dealsById = new Map(deals.map((d) => [d.id, d]));
  const lostOccurrences = pattern.occurrences.filter((o) => o.outcome === "lost");
  const wonOccurrences = pattern.occurrences.filter((o) => o.outcome === "won");

  return (
    <div className="max-w-4xl">
      <Link
        to="/learnings"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
      >
        &larr; Back to Learnings
      </Link>

      <h1 className="mb-2 text-xl font-semibold text-ink dark:text-slate-100 sm:text-2xl">{pattern.name}</h1>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <ConfidenceBadge confidence={pattern.confidence} />
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {pattern.segment_definition.industry ? `${pattern.segment_definition.industry} · ` : ""}
          {pattern.segment_definition.segment?.replace("_", "-")}
        </span>
      </div>

      <Card className="mb-8">
        <p className="mb-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200">{pattern.narrative}</p>
        <RatioBar lostCount={pattern.lost_count} wonCount={pattern.won_count} />
        <div className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          {pattern.sample_size} total deals in this segment
        </div>
      </Card>

      <SectionLabel>Deals behind this pattern</SectionLabel>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400">
            Lost ({lostOccurrences.length})
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {lostOccurrences.map((o) => {
              const deal = dealsById.get(o.deal_id);
              return (
                <li key={o.deal_id} className="py-2 text-sm">
                  <Link
                    to={`/deals/${o.deal_id}`}
                    className="font-medium text-ink hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                  >
                    {deal?.company_name ?? o.deal_id}
                  </Link>
                </li>
              );
            })}
            {lostOccurrences.length === 0 && (
              <li className="py-2 text-sm text-slate-400 dark:text-slate-500">None</li>
            )}
          </ul>
        </Card>
        <Card>
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Won ({wonOccurrences.length})
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {wonOccurrences.map((o) => {
              const deal = dealsById.get(o.deal_id);
              return (
                <li key={o.deal_id} className="py-2 text-sm">
                  <Link
                    to={`/deals/${o.deal_id}`}
                    className="font-medium text-ink hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                  >
                    {deal?.company_name ?? o.deal_id}
                  </Link>
                </li>
              );
            })}
            {wonOccurrences.length === 0 && (
              <li className="py-2 text-sm text-slate-400 dark:text-slate-500">None</li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}
