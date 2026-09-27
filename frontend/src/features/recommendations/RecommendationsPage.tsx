import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import type { Recommendation } from "../../types";
import { Card, SectionLabel } from "../../components/Card";
import { PriorityBadge } from "../../components/PriorityBadge";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "actioned", label: "Actioned" },
];

function groupByDepartment(recs: Recommendation[]) {
  const groups = new Map<string, Recommendation[]>();
  for (const r of recs) {
    const list = groups.get(r.department) ?? [];
    list.push(r);
    groups.set(r.department, list);
  }
  return Array.from(groups.entries());
}

function RecommendationRow({ rec, onChanged }: { rec: Recommendation; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const createdAction = rec.actions.find((a) => a.status === "created");

  async function createTask() {
    setBusy(true);
    try {
      const proposed = await api.post<{ id: string }>(`/api/recommendations/${rec.id}/actions`, {
        action_type: "create_task",
      });
      await api.post(`/api/recommendations/actions/${proposed.id}/approve`);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="font-medium text-ink dark:text-slate-100">{rec.title}</div>
        <PriorityBadge priority={rec.priority} />
      </div>
      <p className="mb-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{rec.explanation}</p>
      <p className="mb-3 text-sm font-medium text-slate-800 dark:text-slate-100">→ {rec.recommended_action}</p>
      {createdAction ? (
        <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Graph8 task created ({createdAction.graph8_object_id})
        </div>
      ) : (
        <button
          onClick={createTask}
          disabled={busy}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {busy ? "Creating..." : "Create Graph8 task"}
        </button>
      )}
    </Card>
  );
}

export function RecommendationsPage() {
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  function load() {
    api.get<Recommendation[]>("/api/recommendations").then(setRecs);
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!recs) return null;
    if (statusFilter === "all") return recs;
    if (statusFilter === "actioned") return recs.filter((r) => r.status === "actioned");
    return recs.filter((r) => r.status !== "actioned");
  }, [recs, statusFilter]);

  if (!recs) return <div className="text-slate-400">Loading...</div>;

  const groups = groupByDepartment(filtered ?? []);
  const pendingCount = recs.filter((r) => r.status !== "actioned").length;

  return (
    <div className="max-w-4xl">
      <div className="mb-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-ink dark:text-slate-100">Recommendations</h1>
        <div className="flex w-fit gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                statusFilter === f.value
                  ? "bg-white text-ink shadow-sm dark:bg-slate-700 dark:text-slate-100"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-8 text-slate-500 dark:text-slate-400">
        Business actions generated from recurring patterns, organized by the department that owns each one.
        Creating a Graph8 task requires your explicit approval — nothing is written automatically.
        {pendingCount > 0 && ` ${pendingCount} awaiting a decision.`}
      </p>

      {groups.map(([department, list]) => (
        <div key={department} className="mb-8">
          <SectionLabel>{department.replace(/_/g, " ")}</SectionLabel>
          <div className="space-y-4">
            {list.map((r) => (
              <RecommendationRow key={r.id} rec={r} onChanged={load} />
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 && (
        <Card className="text-sm text-slate-500 dark:text-slate-400">
          {statusFilter === "all" ? "No recommendations yet." : `No ${statusFilter} recommendations.`}
        </Card>
      )}
    </div>
  );
}
