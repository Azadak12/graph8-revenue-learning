import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Card } from "../../components/Card";

interface DemoDealsResponse {
  closed: { external_id: string; company_name: string; outcome: string }[];
}

const PROGRESS_STEPS = [
  "Reviewing deal history",
  "Reviewing stakeholders",
  "Reviewing meetings",
  "Reviewing objections",
  "Comparing previous outcomes",
];

export function DemoConsole() {
  const [deals, setDeals] = useState<DemoDealsResponse["closed"]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    api.get<DemoDealsResponse>("/api/demo/deals").then((res) => setDeals(res.closed));
  }, []);

  async function simulate(externalId: string, companyName: string) {
    setActive(companyName);
    setDone(null);
    setStep(0);

    const stepTimer = setInterval(() => {
      setStep((s) => Math.min(s + 1, PROGRESS_STEPS.length - 1));
    }, 700);

    const res = await api.post<{ event_id: string }>(`/api/demo/simulate-close/${externalId}`);

    const poll = async () => {
      const status = await api.get<{ processing_status: string }>(`/api/webhooks/events/${res.event_id}`);
      if (status.processing_status === "completed" || status.processing_status === "failed") {
        clearInterval(stepTimer);
        setActive(null);
        setDone(companyName);
        return;
      }
      setTimeout(poll, 500);
    };
    setTimeout(poll, 500);
  }

  return (
    <Card>
      <div className="mb-1 font-medium text-ink dark:text-slate-100">Demo console</div>
      <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
        Simulates Graph8 delivering a{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">deal.won</code> /{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">deal.lost</code> webhook for a seeded
        deal, through the same async pipeline a real webhook would use.
      </p>

      {active && (
        <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50 p-4 dark:border-indigo-900 dark:bg-indigo-950">
          <div className="mb-1 text-sm font-medium text-indigo-800 dark:text-indigo-300">
            Learning from {active}...
          </div>
          <div className="text-sm text-indigo-600 dark:text-indigo-400">{PROGRESS_STEPS[step]}...</div>
        </div>
      )}
      {done && !active && (
        <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          Analysis complete for {done}. Check the Deals or Learnings page.
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {deals.map((d) => (
          <button
            key={d.external_id}
            onClick={() => simulate(d.external_id, d.company_name)}
            disabled={!!active}
            className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span>{d.company_name}</span>
            <span
              className={`text-xs font-medium ${d.outcome === "won" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
            >
              {d.outcome}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
