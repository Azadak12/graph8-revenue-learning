import { useState } from "react";
import { api } from "../../api/client";

const REASONS = [
  { value: "pricing", label: "Pricing" },
  { value: "missing_capability", label: "Missing capability" },
  { value: "competitor", label: "Competitor" },
  { value: "security_compliance", label: "Security / compliance" },
  { value: "budget_timing", label: "Budget / timing" },
  { value: "buyer_cancelled_internally", label: "Buyer cancelled internally" },
  { value: "stakeholder_issue", label: "Stakeholder issue" },
  { value: "other", label: "Other" },
];

const PILL_SELECTED = "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300";
const PILL_UNSELECTED =
  "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

export function FeedbackForm({ dealId, onDone }: { dealId: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [anotherVendor, setAnotherVendor] = useState<string>("");
  const [couldHaveDone, setCouldHaveDone] = useState<string>("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      await api.post(`/api/deals/${dealId}/feedback`, {
        feedback_type: "clarification",
        selected_reason: reason || null,
        another_vendor_selected: anotherVendor === "" ? null : anotherVendor === "yes",
        was_seller_controllable:
          couldHaveDone === "" ? null : couldHaveDone === "yes" ? true : couldHaveDone === "no" ? false : null,
        comment: comment || null,
      });
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 text-sm font-medium text-ink dark:text-slate-100">What was the main reason?</div>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={`rounded-full border px-3 py-1 text-sm ${reason === r.value ? PILL_SELECTED : PILL_UNSELECTED}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-ink dark:text-slate-100">Was another vendor selected?</div>
        <div className="flex gap-2">
          {["yes", "no", "unknown"].map((v) => (
            <button
              key={v}
              onClick={() => setAnotherVendor(v)}
              className={`rounded-full border px-3 py-1 text-sm capitalize ${anotherVendor === v ? PILL_SELECTED : PILL_UNSELECTED}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-ink dark:text-slate-100">
          Could we realistically have done something differently?
        </div>
        <div className="flex gap-2">
          {["yes", "no", "unsure"].map((v) => (
            <button
              key={v}
              onClick={() => setCouldHaveDone(v)}
              className={`rounded-full border px-3 py-1 text-sm capitalize ${couldHaveDone === v ? PILL_SELECTED : PILL_UNSELECTED}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-sm font-medium text-ink dark:text-slate-100">Optional comment</div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          placeholder="Anything else worth noting..."
        />
      </div>

      <button
        onClick={submit}
        disabled={submitting}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        {submitting ? "Submitting..." : "Submit"}
      </button>
    </div>
  );
}
