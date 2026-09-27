export function OutcomeBadge({ outcome }: { outcome: string }) {
  const o = outcome?.toLowerCase();
  const styles =
    o === "won"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900"
      : o === "lost"
        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900"
        : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950 dark:text-sky-300 dark:border-sky-900";
  const label = o === "won" ? "Closed Won" : o === "lost" ? "Closed Lost" : "Open";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      {label}
    </span>
  );
}
