import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { DealDetail, DealListItem } from "../../types";
import { Card } from "../../components/Card";
import { OutcomeBadge } from "../../components/OutcomeBadge";
import { DealDetailView } from "./DealDetailView";

const OUTCOME_FILTERS = [
  { value: "", label: "All" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "open", label: "Open" },
];

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    amount
  );
}

function formatCompactCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact" }).format(
    amount
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" stroke="currentColor" className="h-4 w-4">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function DealsListPage() {
  const [deals, setDeals] = useState<DealListItem[] | null>(null);
  const [outcome, setOutcome] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDeal, setSelectedDeal] = useState<DealDetail | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  useEffect(() => {
    const q = outcome ? `?outcome=${outcome}` : "";
    api.get<DealListItem[]>(`/api/deals${q}`).then(setDeals);
  }, [outcome]);

  const filtered = useMemo(() => {
    if (!deals) return null;
    if (!search.trim()) return deals;
    const q = search.toLowerCase();
    return deals.filter((d) => d.company_name.toLowerCase().includes(q) || d.industry.toLowerCase().includes(q));
  }, [deals, search]);

  // Default-select the first row whenever the visible list changes and the
  // current selection has fallen out of it (e.g. a filter/search removed it).
  useEffect(() => {
    if (!filtered) return;
    if (filtered.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filtered.some((d) => d.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  function loadSelectedDeal() {
    if (selectedId) api.get<DealDetail>(`/api/deals/${selectedId}`).then(setSelectedDeal);
  }

  useEffect(() => {
    setSelectedDeal(null);
    loadSelectedDeal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const summary = useMemo(() => {
    if (!deals) return null;
    const totalAmount = deals.reduce((sum, d) => sum + d.amount, 0);
    const closed = deals.filter((d) => d.outcome === "won" || d.outcome === "lost");
    const won = closed.filter((d) => d.outcome === "won").length;
    const winRate = closed.length > 0 ? Math.round((won / closed.length) * 100) : null;
    return { count: deals.length, totalAmount, winRate };
  }, [deals]);

  function openDeal(id: string) {
    setSelectedId(id);
    setMobileDetailOpen(true);
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-ink dark:text-slate-100">Deals</h1>
        <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {OUTCOME_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setOutcome(f.value)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                outcome === f.value
                  ? "bg-white text-ink shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {summary && (
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          {summary.count} deal{summary.count === 1 ? "" : "s"} &middot; {formatCompactCurrency(summary.totalAmount)}{" "}
          total pipeline
          {summary.winRate !== null && <> &middot; {summary.winRate}% win rate on closed deals</>}
        </p>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by company or industry..."
        className="mb-4 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />

      <div className="flex items-start gap-6">
        <Card className="!p-0 w-full flex-shrink-0 overflow-hidden md:w-[340px]">
          <ul className="max-h-[calc(100vh-260px)] overflow-y-auto">
            {filtered?.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => openDeal(d.id)}
                  className={`flex w-full items-center gap-2 border-b border-slate-50 px-4 py-3 text-left last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${
                    selectedId === d.id
                      ? "border-l-2 border-l-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                      : "border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-ink dark:text-slate-100">{d.company_name}</span>
                      <OutcomeBadge outcome={d.outcome} />
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {d.industry} &middot; {formatCurrency(d.amount, d.currency)}
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-slate-300 dark:text-slate-600">
                    <EyeIcon />
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {filtered?.length === 0 && (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400">No deals match this filter.</div>
          )}
        </Card>

        <div
          className={`min-w-0 flex-1 ${
            mobileDetailOpen
              ? "fixed inset-0 z-40 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950 md:static md:z-auto md:bg-transparent md:p-0"
              : "hidden md:block"
          }`}
        >
          <button
            onClick={() => setMobileDetailOpen(false)}
            className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 md:hidden"
          >
            &larr; Back to list
          </button>
          {selectedId && (
            <div className="mb-3 hidden text-right md:block">
              <Link
                to={`/deals/${selectedId}`}
                className="text-xs font-medium text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400"
              >
                Open full page ↗
              </Link>
            </div>
          )}
          {!selectedId ? (
            <Card className="text-sm text-slate-500 dark:text-slate-400">Select a deal on the left to see details.</Card>
          ) : !selectedDeal ? (
            <div className="text-slate-400">Loading...</div>
          ) : (
            <DealDetailView deal={selectedDeal} onRefresh={loadSelectedDeal} />
          )}
        </div>
      </div>
    </div>
  );
}
