export function LiveModeBanner() {
  return (
    <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
      <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      LIVE MODE — connected to a real Graph8 account
    </div>
  );
}
