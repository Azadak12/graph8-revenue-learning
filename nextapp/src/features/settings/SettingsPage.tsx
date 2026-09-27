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
