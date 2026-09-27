import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { OverviewSummary } from "../../types";
import { Card, SectionLabel } from "../../components/Card";
import { ConfidenceBadge } from "../../components/ConfidenceBadge";
import { PatternStrengthBadge } from "../../components/PatternStrengthBadge";
import { RatioBar } from "../../components/RatioBar";
import { NeedsAttentionSection } from "./NeedsAttentionSection";

export function OverviewPage() {
  const [data, setData] = useState<OverviewSummary | null>(null);

  useEffect(() => {
    api.get<OverviewSummary>("/api/overview").then(setData);
  }, []);

  if (!data) return <div className="text-slate-400">Loading...</div>;

  return (
    <div className="max-w-5xl">
      <h1 className="mb-1 text-xl font-semibold text-ink dark:text-slate-100 sm:text-2xl">
        What are we learning from our deals?
      </h1>
      <p className="mb-8 text-slate-500 dark:text-slate-400">
        {data.total_deals_analyzed} closed deals analyzed &middot; {data.won_count} won &middot;{" "}
        {data.lost_count} lost
        {data.awaiting_clarification > 0 && (
          <> &middot; {data.awaiting_clarification} awaiting rep clarification</>
        )}
      </p>

      <SectionLabel>Executive summary</SectionLabel>
      <Card className="mb-8">
        <ul className="mb-4 space-y-3">
          {data.executive_summary.map((line, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-400" />
              {line}
            </li>
          ))}
        </ul>
        {(data.won_count > 0 || data.lost_count > 0) && (
          <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
            <RatioBar lostCount={data.lost_count} wonCount={data.won_count} />
          </div>
        )}
      </Card>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="text-3xl font-semibold text-ink dark:text-slate-100">{data.won_count}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Won deals analyzed</div>
        </Card>
        <Card>
          <div className="text-3xl font-semibold text-ink dark:text-slate-100">{data.lost_count}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Lost deals analyzed</div>
        </Card>
        <Card>
          <div className="text-3xl font-semibold text-ink dark:text-slate-100">{data.awaiting_clarification}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Awaiting clarification</div>
        </Card>
      </div>

      <NeedsAttentionSection />

      <SectionLabel>Emerging patterns</SectionLabel>
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.emerging_patterns.slice(0, 4).map((p) => (
          <Link key={p.id} to={`/learnings/${p.id}`}>
            <Card className="h-full transition hover:border-indigo-200 hover:shadow-md dark:hover:border-indigo-800">
              <div className="mb-2 flex items-center justify-between">
                <PatternStrengthBadge strength={p.pattern_strength} />
                <ConfidenceBadge confidence={p.confidence} />
              </div>
              <div className="mb-1 text-sm font-semibold text-ink dark:text-slate-100">{p.name}</div>
              <p className="mb-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{p.narrative}</p>
              <RatioBar lostCount={p.lost_count} wonCount={p.won_count} />
            </Card>
          </Link>
        ))}
        {data.emerging_patterns.length === 0 && (
          <Card className="col-span-1 text-sm text-slate-500 dark:text-slate-400 sm:col-span-2">
            Not enough closed deals analyzed yet to surface organization-wide patterns.
          </Card>
        )}
      </div>

      <SectionLabel>Where should we focus?</SectionLabel>
      <Card>
        <div className="flex flex-wrap gap-2">
          {data.focus_areas.map((area) => (
            <span
              key={area}
              className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {area.replace(/_/g, " ")}
            </span>
          ))}
          {data.focus_areas.length === 0 && (
            <span className="text-sm text-slate-500 dark:text-slate-400">No department focus areas identified yet.</span>
          )}
        </div>
      </Card>
    </div>
  );
}
