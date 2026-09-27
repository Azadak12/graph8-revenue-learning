import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { DealListItem, RepPerformance } from "../../types";

const COACHING_PHRASE: Record<string, string> = {
  poor_discovery: "discovery",
  poor_demo: "demos",
  slow_followup: "follow-up speed",
  proposal_delay: "proposal turnaround time",
  communication: "communication with buyers",
  missing_decision_maker: "identifying the decision maker earlier",
  weak_champion: "building a stronger internal champion",
  stakeholder_misalignment: "stakeholder alignment",
  internal_seller_delay: "internal turnaround time",
};

function phraseFor(category: string) {
  return COACHING_PHRASE[category] ?? category.replace(/_/g, " ");
}

function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A1 1 0 003 19.5h18a1 1 0 00.86-1.46L13.7 3.86a1 1 0 00-1.72 0z"
      />
    </svg>
  );
}

interface RepAttentionItem {
  kind: "rep";
  key: string;
  repFirstName: string;
  category: string;
  dealCount: number;
  deals: { id: string; company_name: string }[];
}

interface ClarificationAttentionItem {
  kind: "clarification";
  key: string;
  deal: DealListItem;
}

type AttentionItem = RepAttentionItem | ClarificationAttentionItem;

export function NeedsAttentionSection() {
  const [items, setItems] = useState<AttentionItem[] | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<RepPerformance[]>("/api/reps"),
      api.get<DealListItem[]>("/api/deals"),
    ]).then(([reps, deals]) => {
      const repItems: RepAttentionItem[] = [];
      for (const rep of reps) {
        for (const item of rep.coaching_items) {
          if (!item.recurring) continue;
          repItems.push({
            kind: "rep",
            key: `${rep.owner_name}-${item.category}`,
            repFirstName: rep.owner_name.split(" ")[0],
            category: item.category,
            dealCount: item.deal_count,
            deals: item.deals,
          });
        }
      }
      repItems.sort((a, b) => b.dealCount - a.dealCount);

      const clarificationItems: ClarificationAttentionItem[] = deals
        .filter((d) => d.analysis_status === "needs_clarification")
        .map((d) => ({ kind: "clarification", key: `clarify-${d.id}`, deal: d }));

      setItems([...clarificationItems, ...repItems.slice(0, 4)]);
    });
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <div className="mb-8 rounded-2xl border-2 border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900 dark:bg-amber-950/30">
      <div className="mb-3 flex items-center gap-2 text-amber-800 dark:text-amber-300">
        <AlertIcon />
        <span className="text-xs font-bold uppercase tracking-wide">Needs quick attention</span>
      </div>
      <div className="space-y-3">
        {items.map((item) =>
          item.kind === "clarification" ? (
            <Link key={item.key} to={`/deals/${item.deal.id}`}>
              <div className="flex items-center justify-between gap-4 rounded-xl border border-sky-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-sky-900 dark:bg-slate-900">
                <div>
                  <div className="font-medium text-ink dark:text-slate-100">
                    {item.deal.company_name} needs rep clarification
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    Not enough evidence to determine why this deal closed — a rep needs to answer a few
                    questions.
                  </div>
                </div>
                <span className="flex-shrink-0 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  Action needed
                </span>
              </div>
            </Link>
          ) : (
            <div
              key={item.key}
              className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm dark:border-amber-900 dark:bg-slate-900"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="font-medium text-ink dark:text-slate-100">
                  {item.repFirstName} should work on {phraseFor(item.category)}
                </div>
                <span className="flex-shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  Recurring
                </span>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-slate-400">Seen in {item.dealCount} lost deals:</span>
                {item.deals.map((d) => (
                  <Link
                    key={d.id}
                    to={`/deals/${d.id}`}
                    className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    {d.company_name}
                  </Link>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
