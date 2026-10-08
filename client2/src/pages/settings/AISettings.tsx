import { useEffect, useState, useDeferredValue, useCallback, useRef } from "react";
import { api } from "../../api";
import type { AIModel, AIProvider, AIProviderTestResult, AISettingsResponse } from "../../types";
import { SectionCard, EmptyState, GradientButton } from "../shared";
import { Icon } from "../../components/ui/Icon";

// ─── localStorage helpers ──────────────────────────────────────────

const LS = {
  FAVORITES: "pmwds_ai_fav",
  HISTORY: "pmwds_ai_history",
  CACHE: "pmwds_ai_model_cache",
  CACHE_TTL: 3_600_000, // 1 hour

  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

// ─── Types ──────────────────────────────────────────────────────────

interface TestHistoryEntry {
  provider: string;
  model: string;
  name: string;
  testedAt: string;
  worked: boolean;
}

interface ModelCache {
  [provider: string]: { data: AIModel[]; timestamp: number };
}

// ─── Helpers ────────────────────────────────────────────────────────

function sortModels(models: AIModel[], favIds: string[]): AIModel[] {
  return [...models].sort((a, b) => {
    const af = favIds.includes(a.id) ? -1 : 0;
    const bf = favIds.includes(b.id) ? -1 : 0;
    return af - bf || a.name.localeCompare(b.name);
  });
}

function modelKey(m: AIModel) {
  return `${m.provider}::${m.id}`;
}

// ─── Component ──────────────────────────────────────────────────────

interface AISettingsProps {
  auth: { token: string } | null;
  onSaveComplete: (msg: string) => void;
}

export function AISettings({ auth, onSaveComplete }: AISettingsProps) {
  // ── Server state ──
  const [aiSettings, setAiSettings] = useState<AISettingsResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Provider list ──
  const [providers, setProviders] = useState<AIProvider[]>([]);

  // ── Model explorer ──
  const [explorerTab, setExplorerTab] = useState<"browse" | "favorites" | "history">("browse");
  const [explorerProvider, setExplorerProvider] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [loadAll, setLoadAll] = useState(false);
  const [explorerModels, setExplorerModels] = useState<AIModel[]>([]);
  const [explorerError, setExplorerError] = useState("");
  const [explorerLoading, setExplorerLoading] = useState(false);

  // ── Test panel ──
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [testResult, setTestResult] = useState<AIProviderTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [testingCustom, setTestingCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [customResponse, setCustomResponse] = useState("");

  // ── Persisted client state ──
  const [favorites, setFavorites] = useState<string[]>(() => LS.get<string[]>(LS.FAVORITES, []));
  const [history, setHistory] = useState<TestHistoryEntry[]>(() => LS.get<TestHistoryEntry[]>(LS.HISTORY, []));
  const [modelCache, setModelCache] = useState<ModelCache>(() => LS.get<ModelCache>(LS.CACHE, {}));

  const settingsRef = useRef(aiSettings);
  settingsRef.current = aiSettings;

  // ── Load on mount ──
  useEffect(() => {
    if (!auth) return;
    setAiLoading(true);
    setError("");
    api.getAISettings(auth.token)
      .then((s) => { setAiSettings(s); setExplorerProvider(s.defaultProvider); })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load AI settings"))
      .finally(() => setAiLoading(false));

    api.getAiProviders(auth.token)
      .then(setProviders)
      .catch(() => {});
  }, [auth]);

  // ── Model list: cache or fetch ──
  const loadModels = useCallback(async (provider: string, force = false) => {
    if (!auth || !provider) return;
    const cached = modelCache[provider];
    const now = Date.now();
    if (!force && cached && (now - cached.timestamp) < LS.CACHE_TTL) {
      setExplorerModels(sortModels(cached.data, favorites));
      return;
    }
    setExplorerLoading(true);
    setExplorerError("");
    try {
      const data = await api.searchAiModels(auth.token, provider, "", loadAll ? 200 : 30);
      const sorted = sortModels(data, favorites);
      setExplorerModels(sorted);
      setModelCache((prev) => {
        const next = { ...prev, [provider]: { data, timestamp: now } };
        LS.set(LS.CACHE, next);
        return next;
      });
    } catch {
      setExplorerError("Failed to load models. Check provider API key.");
    } finally {
      setExplorerLoading(false);
    }
  }, [auth, modelCache, favorites, loadAll]);

  // ── Search within cached models ──
  useEffect(() => {
    if (!explorerProvider) return;
    const cached = modelCache[explorerProvider];
    if (!cached) {
      setExplorerModels([]);
      return;
    }
    if (!deferredSearch) {
      setExplorerModels(sortModels(cached.data, favorites));
      return;
    }
    const q = deferredSearch.toLowerCase();
    const filtered = cached.data.filter(
      (m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    );
    setExplorerModels(sortModels(filtered, favorites));
  }, [deferredSearch, explorerProvider]);

  // ── Refresh favorites sort when favorites change ──
  useEffect(() => {
    setExplorerModels((prev) => sortModels(prev, favorites));
  }, [favorites]);

  // ── Helpers ──
  const toggleFavorite = (modelId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId];
      LS.set(LS.FAVORITES, next);
      return next;
    });
  };

  const recordHistory = (entry: TestHistoryEntry) => {
    setHistory((prev) => {
      const filtered = prev.filter((h) => !(h.provider === entry.provider && h.model === entry.model));
      const next = [entry, ...filtered].slice(0, 100);
      LS.set(LS.HISTORY, next);
      return next;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    LS.set(LS.HISTORY, []);
  };

  const updateProvider = (provider: string, field: string, value: unknown) => {
    if (!settingsRef.current) return;
    setAiSettings({
      ...settingsRef.current,
      providers: settingsRef.current.providers.map((p) =>
        p.provider === provider ? { ...p, [field]: value } : p
      ),
    });
    setTestResult(null);
  };

  // ── Test from explorer ──
  const handleTestModel = async () => {
    if (!auth || !selectedModel || !explorerProvider) return;
    setTesting(true);
    setTestResult(null);
    setCustomResponse("");
    try {
      const result = await api.testAiProvider(auth.token, explorerProvider, selectedModel.id, "Reply with: ok");
      setTestResult(result);
      recordHistory({
        provider: explorerProvider,
        model: selectedModel.id,
        name: selectedModel.name,
        testedAt: new Date().toISOString(),
        worked: result.success,
      });
    } catch (e) {
      const fail: AIProviderTestResult = {
        provider: explorerProvider,
        model: selectedModel.id,
        success: false,
        message: e instanceof Error ? e.message : "Test failed",
        rawResponse: null,
        executedAtUtc: new Date().toISOString(),
      };
      setTestResult(fail);
      recordHistory({
        provider: explorerProvider,
        model: selectedModel.id,
        name: selectedModel.name,
        testedAt: new Date().toISOString(),
        worked: false,
      });
    } finally {
      setTesting(false);
    }
  };

  // ── Set as default from test result ──
  const handleSetDefault = (provider?: string, model?: string) => {
    const prov = provider ?? explorerProvider;
    const mdl = model ?? selectedModel?.id ?? "";
    if (!mdl || !settingsRef.current) return;
    setAiSettings({
      ...settingsRef.current,
      defaultProvider: prov,
      defaultModel: mdl,
      providers: settingsRef.current.providers.map((p) =>
        p.provider === prov ? { ...p, defaultModel: mdl } : p
      ),
    });
  };

  // ── Save ──
  const handleSave = async () => {
    if (!settingsRef.current || !auth) return;
    setSaving(true);
    setError("");
    try {
      const s = settingsRef.current;
      const result = await api.saveAISettings(auth.token, {
        defaultProvider: s.defaultProvider,
        defaultModel: s.defaultModel,
        riskThreshold: s.riskThreshold,
        useLocalModel: s.useLocalModel,
        mlModelPath: s.mlModelPath,
        providers: s.providers.map((p) => ({
          provider: p.provider,
          displayName: p.displayName,
          enabled: p.enabled,
          baseUrl: p.baseUrl,
          apiKey: p.apiKey || "",
          defaultModel: p.defaultModel,
          useEnvironmentDefault: p.useEnvironmentDefault,
        })),
      });
      onSaveComplete(result.message || "Settings saved.");
      const fresh = await api.getAISettings(auth.token);
      setAiSettings(fresh);
      setExplorerProvider(fresh.defaultProvider);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTestCustom = async () => {
    if (!auth || !selectedModel || !customPrompt.trim()) return;
    setTestingCustom(true);
    setCustomResponse("");
    try {
      const result = await api.testAiProvider(auth.token, explorerProvider, selectedModel.id, customPrompt);
      setCustomResponse(result.rawResponse || result.message);
      if (!testResult) setTestResult(result);
    } catch (e) {
      setCustomResponse(e instanceof Error ? e.message : "Request failed");
    } finally {
      setTestingCustom(false);
    }
  };

  // ── Derived ──
  const defaultProvider = aiSettings?.defaultProvider ?? "OpenRouter";
  const defaultModelStr = aiSettings?.defaultModel ?? "";
  const currentProvider = aiSettings?.providers.find((p) => p.provider === defaultProvider);
  const defaultProviderDisplay = currentProvider?.displayName ?? defaultProvider;

  const historyFiltered = explorerProvider
    ? history.filter((h) => h.provider === explorerProvider)
    : history;

  const favoritedModels = explorerModels.filter((m) => favorites.includes(m.id));

  // ── Render ──
  if (aiLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400 text-sm gap-2">
        <Icon name="hourglass_top" size={16} className="animate-spin" />
        Loading AI settings...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">

      {/* ───── Active Configuration ───── */}
      <SectionCard title="Active Configuration" icon="check_circle">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active</span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="text-sm">
              <span className="font-semibold text-slate-800">{defaultProviderDisplay}</span>
              {defaultModelStr && (
                <>
                  <span className="text-slate-300 mx-1.5">·</span>
                  <span className="font-mono text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {defaultModelStr}
                  </span>
                </>
              )}
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div className="text-xs text-slate-500">
              Risk threshold: <span className="font-semibold text-slate-700">{aiSettings?.riskThreshold ?? 0.7}</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ───── Error ───── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl py-3 px-4 text-red-700 text-sm flex items-center gap-2">
          <Icon name="error" size={18} className="text-red-500" />
          {error}
        </div>
      )}

      {/* ───── Provider Configuration ───── */}
      <SectionCard
        title="Provider Configuration"
        description="Enable and configure each AI provider"
        icon="hub"
        bodyClassName="p-4 flex flex-col gap-3"
      >
        {aiSettings?.providers.map((provider) => (
          <div
            key={provider.provider}
            className={`rounded-xl border bg-white p-4 transition-all ${
              provider.enabled
                ? "border-slate-200 shadow-sm"
                : "border-slate-100 bg-slate-50/40"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={provider.enabled}
                  onChange={(e) => updateProvider(provider.provider, "enabled", e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="text-sm font-bold text-slate-800">{provider.displayName}</span>
                  <span className="text-[10px] text-slate-400 ml-2 uppercase">{provider.provider}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setExplorerProvider(provider.provider);
                  setSearchQuery("");
                  loadModels(provider.provider);
                }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors inline-flex items-center gap-1"
              >
                <Icon name="database_search" size={14} />
                Browse Models
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Base URL</label>
                <input
                  value={provider.baseUrl}
                  onChange={(e) => updateProvider(provider.provider, "baseUrl", e.target.value)}
                  disabled={!provider.enabled}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs outline-none bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:bg-slate-50 disabled:text-slate-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">API Key</label>
                <div className="flex items-center gap-2 mb-1">
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={provider.useEnvironmentDefault}
                      onChange={(e) => updateProvider(provider.provider, "useEnvironmentDefault", e.target.checked)}
                      disabled={!provider.enabled}
                      className="w-3 h-3 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    .env key
                  </label>
                </div>
                <input
                  type="password"
                  value={provider.apiKey}
                  onChange={(e) => updateProvider(provider.provider, "apiKey", e.target.value)}
                  placeholder={provider.hasStoredKey ? "Replace stored key" : "Enter API key"}
                  disabled={!provider.enabled || provider.useEnvironmentDefault}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs outline-none bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:bg-slate-50"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Default Model</label>
                <input
                  value={provider.defaultModel}
                  onChange={(e) => updateProvider(provider.provider, "defaultModel", e.target.value)}
                  placeholder="e.g. gpt-4o"
                  disabled={!provider.enabled}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs outline-none bg-white font-mono focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all disabled:bg-slate-50"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={async () => {
                    if (!auth || !provider.defaultModel) return;
                    setTesting(true);
                    setTestResult(null);
                    try {
                      const r = await api.testAiProvider(auth.token, provider.provider, provider.defaultModel, "Reply with: ok");
                      setTestResult(r);
                    } catch (e) {
                      setTestResult({ provider: provider.provider, model: provider.defaultModel, success: false, message: e instanceof Error ? e.message : "Failed", rawResponse: null, executedAtUtc: new Date().toISOString() });
                    } finally {
                      setTesting(false);
                    }
                  }}
                  disabled={testing || !provider.enabled || !provider.defaultModel}
                  className="h-9 flex-1 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  <Icon name={testing ? "hourglass_top" : "bolt"} size={14} />
                  {testing ? "Testing..." : "Test"}
                </button>
              </div>
            </div>
            {testResult && testResult.provider === provider.provider && (
              <div className={`mt-3 p-3 rounded-lg text-xs border flex items-center gap-2 flex-wrap ${
                testResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-red-50 border-red-200 text-red-700"
              }`}>
                <Icon name={testResult.success ? "check_circle" : "error"} size={14} />
                <span className="font-mono font-semibold">{testResult.model}</span>
                <span className="flex-1">{testResult.message}</span>
                {testResult.success && (
                  <button
                    onClick={() => handleSetDefault(provider.provider, testResult.model)}
                    className="px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    Set as Default
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </SectionCard>

      {/* ───── Model Explorer ───── */}
      <SectionCard
        title="Model Explorer"
        description="Browse, favorite, and test available models"
        icon="database_search"
        bodyClassName="p-0"
      >
        {/* Tabs */}
        <div className="flex items-center gap-1 px-3 pt-3 border-b border-slate-100">
          {(["browse", "favorites", "history"] as const).map((tab) => {
            const active = explorerTab === tab;
            const count =
              tab === "favorites"
                ? favorites.length
                : tab === "history"
                ? historyFiltered.length
                : undefined;
            return (
              <button
                key={tab}
                onClick={() => {
                  setExplorerTab(tab);
                  setTestResult(null);
                  setCustomResponse("");
                  if (tab === "browse" && explorerProvider) loadModels(explorerProvider);
                }}
                className={`inline-flex items-center gap-1.5 px-3 h-9 text-xs font-semibold transition-all border-b-2 -mb-px ${
                  active
                    ? "text-indigo-600 border-indigo-500"
                    : "text-slate-500 hover:text-slate-700 border-transparent"
                }`}
              >
                <Icon name={tab === "browse" ? "database_search" : tab === "favorites" ? "star" : "history"} size={14} />
                <span className="capitalize">{tab}</span>
                {count !== undefined && count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          {/* Provider selector (browse + favorites) */}
          {(explorerTab === "browse" || explorerTab === "favorites") && (
            <div className="flex items-center gap-2 mb-3">
              <select
                value={explorerProvider}
                onChange={(e) => {
                  setExplorerProvider(e.target.value);
                  setSelectedModel(null);
                  setTestResult(null);
                  setCustomResponse("");
                  setSearchQuery("");
                  loadModels(e.target.value);
                }}
                className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-700 bg-white outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              >
                {providers.map((p) => (
                  <option key={p.provider} value={p.provider}>{p.displayName}</option>
                ))}
              </select>
              {explorerTab === "browse" && (
                <div className="relative flex-1">
                  <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search models..."
                    className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-xs outline-none bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                  />
                </div>
              )}
              {explorerTab === "browse" && (
                <button
                  type="button"
                  onClick={() => { setLoadAll((prev) => !prev); loadModels(explorerProvider, true); }}
                  className={`h-9 px-3 rounded-lg border text-xs font-semibold whitespace-nowrap transition-colors ${
                    loadAll
                      ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                      : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50"
                  }`}
                >
                  {loadAll ? "All" : "Recent 30"}
                </button>
              )}
            </div>
          )}

          {/* Content */}
          {explorerError && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Icon name="warning" size={14} />
                {explorerError}
              </span>
              <button
                onClick={() => loadModels(explorerProvider, true)}
                className="ml-3 px-2.5 py-1 rounded-md bg-amber-600 text-white text-[10px] font-semibold hover:bg-amber-700 transition-colors shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {explorerLoading && (
            <div className="text-xs text-slate-400 text-center py-6 flex items-center justify-center gap-2">
              <Icon name="hourglass_top" size={14} className="animate-spin" />
              Loading models...
            </div>
          )}

          {!explorerLoading && explorerTab === "browse" && (
            <ModelList
              models={explorerModels}
              favorites={favorites}
              selectedModelId={selectedModel?.id ?? ""}
              onSelect={setSelectedModel}
              onToggleFavorite={toggleFavorite}
              empty="No models found. Try a different search or provider."
              showContext
            />
          )}

          {!explorerLoading && explorerTab === "favorites" && (
            <ModelList
              models={favoritedModels}
              favorites={favorites}
              selectedModelId={selectedModel?.id ?? ""}
              onSelect={setSelectedModel}
              onToggleFavorite={toggleFavorite}
              empty="No favorite models yet. Browse and star models you use often."
              showContext={false}
            />
          )}

          {!explorerLoading && explorerTab === "history" && (
            <div>
              {historyFiltered.length > 0 && (
                <div className="flex justify-end mb-2">
                  <button
                    onClick={clearHistory}
                    className="text-[10px] font-semibold text-red-500 hover:text-red-700 transition-colors inline-flex items-center gap-1"
                  >
                    <Icon name="delete_sweep" size={12} />
                    Clear all
                  </button>
                </div>
              )}
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {historyFiltered.map((entry, i) => (
                  <div
                    key={`${entry.testedAt}-${i}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                    onClick={() => {
                      setExplorerProvider(entry.provider);
                      setSelectedModel({ provider: entry.provider, id: entry.model, name: entry.name } as AIModel);
                      setExplorerTab("browse");
                      loadModels(entry.provider);
                    }}
                  >
                    <Icon
                      name={entry.worked ? "check_circle" : "cancel"}
                      size={16}
                      className={entry.worked ? "text-emerald-500" : "text-red-400"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 truncate">{entry.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{entry.model}</div>
                    </div>
                    <div className="text-[10px] text-slate-400 shrink-0">{formatTimeAgo(entry.testedAt)}</div>
                  </div>
                ))}
                {historyFiltered.length === 0 && (
                  <EmptyState
                    icon="history"
                    title="No test history yet"
                    description="Test a model to see it here."
                    compact
                    accent="neutral"
                  />
                )}
              </div>
            </div>
          )}

          {/* ───── Test Output Panel ───── */}
          {selectedModel && (explorerTab === "browse" || explorerTab === "favorites") && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              {/* Selected model badge + test button */}
              <div className="flex items-center justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-700 truncate">{selectedModel.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{selectedModel.id}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  <button
                    onClick={handleTestModel}
                    disabled={testing}
                    className={`px-4 h-8 rounded-lg text-xs font-semibold transition-all inline-flex items-center gap-1 ${
                      testResult?.success
                        ? "bg-emerald-600 text-white"
                        : testResult?.success === false
                        ? "bg-red-600 text-white"
                        : "bg-indigo-600 text-white hover:bg-indigo-700"
                    } disabled:opacity-50`}
                  >
                    <Icon name={testing ? "hourglass_top" : "bolt"} size={14} />
                    {testing ? "Testing..." : testResult ? (testResult.success ? "Connected" : "Failed") : "Test"}
                  </button>
                  {testResult?.success && (
                    <button
                      onClick={() => handleSetDefault()}
                      className="px-4 h-8 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all inline-flex items-center gap-1"
                    >
                      <Icon name="push_pin" size={14} />
                      Set Default
                    </button>
                  )}
                </div>
              </div>

              {/* Test result message */}
              {testResult && (
                <div className={`p-3 rounded-lg text-xs border mb-3 flex items-center gap-2 ${
                  testResult.success
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-red-50 border-red-200 text-red-700"
                }`}>
                  <Icon name={testResult.success ? "check_circle" : "error"} size={14} />
                  {testResult.message}
                </div>
              )}

              {/* Custom prompt */}
              <div className="flex gap-2">
                <input
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Custom test prompt..."
                  className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-xs outline-none bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
                <button
                  onClick={handleTestCustom}
                  disabled={testingCustom || !customPrompt.trim()}
                  className="h-9 px-4 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                >
                  <Icon name={testingCustom ? "hourglass_top" : "play_arrow"} size={14} />
                  {testingCustom ? "Running..." : "Run"}
                </button>
              </div>
              {customResponse && (
                <pre className="mt-3 p-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-300 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {customResponse}
                </pre>
              )}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ───── Save ───── */}
      <div className="flex justify-end">
        <GradientButton onClick={handleSave} disabled={saving}>
          <Icon name="save" size={14} />
          {saving ? "Saving..." : "Save AI Settings"}
        </GradientButton>
      </div>
    </div>
  );
}

// ─── Model List Sub-component ─────────────────────────────────────

function ModelList({
  models,
  favorites,
  selectedModelId,
  onSelect,
  onToggleFavorite,
  empty,
  showContext,
}: {
  models: AIModel[];
  favorites: string[];
  selectedModelId: string;
  onSelect: (m: AIModel) => void;
  onToggleFavorite: (id: string) => void;
  empty: string;
  showContext: boolean;
}) {
  if (models.length === 0) {
    return (
      <EmptyState
        icon="inbox"
        title="No models found"
        description={empty}
        compact
        accent="neutral"
      />
    );
  }
  return (
    <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
      {models.map((m) => {
        const isFav = favorites.includes(m.id);
        const isSelected = selectedModelId === m.id;
        return (
          <div
            key={m.id}
            className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-all duration-200 border ${
              isSelected
                ? "bg-indigo-50 border-indigo-200"
                : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200"
            }`}
            onClick={() => onSelect(m)}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(m.id); }}
              className={`shrink-0 transition-colors ${isFav ? "text-amber-400" : "text-slate-300 hover:text-amber-300"}`}
              title={isFav ? "Unfavorite" : "Favorite"}
            >
              <Icon name="star" size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-800 truncate">{m.name}</div>
              <div className="text-[10px] text-slate-400 font-mono truncate">{m.id}</div>
            </div>
            {showContext && (
              <span className="text-[10px] text-slate-400 shrink-0">
                {m.contextLength ? `${(m.contextLength / 1000).toFixed(0)}k` : "?"}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Time ago helper ──────────────────────────────────────────────

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
