import { useState } from "react";
import type { DealDetail, Evidence, Factor } from "../../types";
import { Card, SectionLabel } from "../../components/Card";
import { OutcomeBadge } from "../../components/OutcomeBadge";
import { ConfidenceBadge } from "../../components/ConfidenceBadge";
import { StageTimeline } from "../../components/StageTimeline";
import { FeedbackForm } from "./FeedbackForm";

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    amount
  );
}

function FactorCard({ factor, evidenceOpen, onToggle }: { factor: Factor; evidenceOpen: boolean; onToggle: () => void }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            {factor.category.replace(/_/g, " ")} &middot; {factor.department.replace(/_/g, " ")}
          </div>
          <div className="mt-1 text-sm font-medium text-ink dark:text-slate-100">{factor.specific_issue}</div>
        </div>
        <ConfidenceBadge confidence={factor.confidence} />
      </div>
      {factor.evidence.length > 0 && (
        <div className="mt-3">
          <button
            onClick={onToggle}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            {evidenceOpen ? "Hide evidence" : `Why do we think this? (${factor.evidence.length})`}
          </button>
          {evidenceOpen && (
            <ul className="mt-3 space-y-2">
              {factor.evidence.map((e: Evidence) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
                >
                  <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {e.source_type.replace(/_/g, " ")} &middot; {e.strength}
                  </div>
                  {e.finding}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

type Tab = "why" | "stakeholders" | "correction";

/** The full "why did this deal close the way it did" view. Shared between the
 * standalone /deals/:dealId page and the inline detail panel on the Deals list,
 * so the two never drift out of sync.
 *
 * Header/timeline/warnings/summary stay always visible (short, worth seeing at
 * a glance); factors, stakeholders, and correction are tabbed instead of
 * stacked, so reading one deal doesn't require scrolling through everything. */
export function DealDetailView({ deal, onRefresh }: { deal: DealDetail; onRefresh: () => void }) {
  const [tab, setTab] = useState<Tab>("why");
  const [openEvidenceId, setOpenEvidenceId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);

  const analysis = deal.analysis;
  const primary = analysis?.factors.find((f) => f.is_primary);
  const secondary = analysis?.factors.filter((f) => !f.is_primary) ?? [];

  const tabs: { key: Tab; label: string }[] = [
    { key: "why", label: "Why it happened" },
    { key: "stakeholders", label: `Stakeholders (${deal.contacts.length})` },
    { key: "correction", label: "Correction" },
  ];

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold text-ink dark:text-slate-100">{deal.company_name}</h1>
          <p className="text-slate-500 dark:text-slate-400">
            {formatCurrency(deal.amount, deal.currency)} &middot; {deal.industry} &middot;{" "}
            {deal.segment.replace("_", "-")}
          </p>
        </div>
        <OutcomeBadge outcome={deal.outcome} />
      </div>

      {deal.stage_history.length > 0 && (
        <Card className="mb-4">
          <StageTimeline stages={deal.stage_history} outcome={deal.outcome} />
        </Card>
      )}

      {deal.warnings.length > 0 && (
        <Card className="mb-4 border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40">
          {deal.warnings.map((w) => (
            <p key={w.id} className="text-sm leading-relaxed text-amber-900 dark:text-amber-200">
              {w.explanation}
            </p>
          ))}
        </Card>
      )}

      {!analysis && (
        <Card className="text-sm text-slate-500 dark:text-slate-400">
          No analysis has been generated for this deal yet.
        </Card>
      )}

      {analysis && (
        <>
          <Card className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <ConfidenceBadge confidence={analysis.confidence} />
              {analysis.human_confirmation_required && (
                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Awaiting rep clarification
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">{analysis.summary}</p>
          </Card>

          <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                  tab === t.key
                    ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "why" && (
            <div className="space-y-4">
              {primary && (
                <>
                  <SectionLabel>Primary factor</SectionLabel>
                  <FactorCard
                    factor={primary}
                    evidenceOpen={openEvidenceId === primary.id}
                    onToggle={() => setOpenEvidenceId(openEvidenceId === primary.id ? null : primary.id)}
                  />
                </>
              )}
              {secondary.length > 0 && (
                <>
                  <SectionLabel>Other contributing factors</SectionLabel>
                  <div className="space-y-3">
                    {secondary.map((f) => (
                      <FactorCard
                        key={f.id}
                        factor={f}
                        evidenceOpen={openEvidenceId === f.id}
                        onToggle={() => setOpenEvidenceId(openEvidenceId === f.id ? null : f.id)}
                      />
                    ))}
                  </div>
                </>
              )}
              {!primary && secondary.length === 0 && (
                <Card className="text-sm text-slate-500 dark:text-slate-400">
                  No specific factor could be confidently identified.
                </Card>
              )}
            </div>
          )}

          {tab === "stakeholders" && (
            <Card>
              {deal.contacts.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No stakeholders recorded.</p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                  {deal.contacts.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <div className="min-w-0 truncate">
                        <span className="font-medium text-ink dark:text-slate-100">{c.name}</span>
                        {c.title && <span className="text-slate-400 dark:text-slate-500"> &middot; {c.title}</span>}
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {c.role.replace("_", " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {tab === "correction" && (
            <Card>
              {justSubmitted ? (
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Thanks — your answer has been recorded and the analysis updated above.
                </p>
              ) : !showFeedback ? (
                <button
                  onClick={() => setShowFeedback(true)}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  {analysis.human_confirmation_required ? "Answer clarification questions" : "Correct analysis"}
                </button>
              ) : (
                <FeedbackForm
                  dealId={deal.id}
                  onDone={() => {
                    setShowFeedback(false);
                    setJustSubmitted(true);
                    onRefresh();
                    setTimeout(() => setJustSubmitted(false), 4000);
                  }}
                />
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
