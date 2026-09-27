import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import type { DealDetail } from "../../types";
import { DealDetailView } from "./DealDetailView";

export function DealDetailPage() {
  const { dealId } = useParams();
  const [deal, setDeal] = useState<DealDetail | null>(null);

  function load() {
    if (dealId) api.get<DealDetail>(`/api/deals/${dealId}`).then(setDeal);
  }

  useEffect(load, [dealId]);

  if (!deal) return <div className="text-slate-400">Loading...</div>;

  return (
    <div className="max-w-4xl">
      <Link
        to="/deals"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
      >
        &larr; Back to Deals
      </Link>
      <DealDetailView deal={deal} onRefresh={load} />
    </div>
  );
}
