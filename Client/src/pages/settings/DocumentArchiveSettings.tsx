import { useEffect, useState } from "react";
import { api } from "../../api";
import type { AuthState } from "../../auth";

interface DocumentArchiveSettingsProps {
  auth: AuthState | null;
  onSaved: (message: string) => void;
}

export function DocumentArchiveSettings({ auth, onSaved }: DocumentArchiveSettingsProps) {
  const [retentionDays, setRetentionDays] = useState("30");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    api.getDocumentArchiveSettings(auth.token)
      .then((settings) => setRetentionDays(String(settings.retentionDays)))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load archive settings."))
      .finally(() => setLoading(false));
  }, [auth]);

  const handleSave = async () => {
    if (!auth) return;
    const days = Number(retentionDays);
    if (!Number.isInteger(days) || days < 1) {
      setError("Enter a whole number of at least one day.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const saved = await api.updateDocumentArchiveSettings(auth.token, days);
      setRetentionDays(String(saved.retentionDays));
      onSaved("Document archive retention saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save archive settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-800">Document archive</h2>
      <p className="mt-1 text-sm text-slate-500">
        Archived documents are permanently deleted after this many days. The default is 30 days.
      </p>
      <label className="mt-5 block max-w-xs">
        <span className="text-xs font-semibold text-slate-600">Retention period (days)</span>
        <input
          type="number"
          min="1"
          step="1"
          value={retentionDays}
          onChange={(event) => setRetentionDays(event.target.value)}
          disabled={loading || saving}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
      </label>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={loading || saving || !auth}
        className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save retention"}
      </button>
    </section>
  );
}
