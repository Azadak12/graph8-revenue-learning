import { useEffect, useState } from "react";
import { api } from "../../api/client";
import { Card, SectionLabel } from "../../components/Card";
import { DemoConsole } from "./DemoConsole";

interface ConnectionInfo {
  mode: string;
  status: string;
  graph8_org_id: string | null;
  last_sync_at: string | null;
}

export function SettingsPage() {
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  function load() {
    api.get<ConnectionInfo>("/api/settings/graph8-connection").then(setConnection);
  }
  useEffect(load, []);

  async function saveKey() {
    setSaving(true);
    try {
      await api.post("/api/settings/graph8-connection", { api_key: apiKey });
      setApiKey("");
      load();
    } finally {
      setSaving(false);
    }
  }

  async function syncDeals() {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await api.post<{ closed: number; active: number; analyzed: number; failed: number }>(
        "/api/settings/graph8-sync"
      );
      setSyncMessage(
        `Imported ${res.closed} closed and ${res.active} open deals from Graph8. ${res.analyzed} analyzed` +
          (res.failed ? `, ${res.failed} failed.` : ".")
      );
      load();
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-8 text-2xl font-semibold text-ink dark:text-slate-100">Settings</h1>

      <SectionLabel>Graph8 connection</SectionLabel>
      <Card className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="font-medium text-ink capitalize dark:text-slate-100">
              {connection?.mode ?? "demo"} mode
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Status: <span className="capitalize">{connection?.status ?? "not configured"}</span>
            </div>
          </div>
        </div>
        <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
          Add a Graph8 API key to switch this organization to Live Mode. The key is encrypted at rest and
          never sent back to this page after saving.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Graph8 API key"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            onClick={saveKey}
            disabled={saving || !apiKey}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
        {connection?.mode === "live" && (
          <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              Replace the demo data with your real deals: imports every closed and open deal from Graph8 and
              analyzes it.{connection.last_sync_at && ` Last synced ${new Date(connection.last_sync_at).toLocaleString()}.`}
            </p>
            <button
              onClick={syncDeals}
              disabled={syncing}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {syncing ? "Syncing... this can take a minute" : "Sync deals from Graph8"}
            </button>
            {syncMessage && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{syncMessage}</p>}
          </div>
        )}
      </Card>

      {connection?.mode !== "live" && (
        <>
          <SectionLabel>Demo</SectionLabel>
          <DemoConsole />
        </>
      )}
    </div>
  );
}
