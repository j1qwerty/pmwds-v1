import React, { useState, useEffect } from 'react';
import type { BgConfig, BgPreset, BgPatternType } from './types';
import { BgRenderer } from './BgRenderer';
import { DEFAULT_CONFIG, BUILTIN_PRESETS, loadSavedPresets, saveCustomPreset, deleteCustomPreset } from './presets';

const ANIM_OPTIONS: { value: string; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'float', label: 'Float' },
  { value: 'pulse', label: 'Pulse' },
  { value: 'rotate', label: 'Rotate' },
  { value: 'drift', label: 'Drift' },
  { value: 'breathe', label: 'Breathe' },
];

const GRADIENT_TYPES: { value: string; label: string }[] = [
  { value: 'radial', label: 'Radial' },
  { value: 'linear', label: 'Linear' },
  { value: 'conic', label: 'Conic' },
];

const PATTERN_LIST: { key: BgPatternType; label: string }[] = [
  { key: 'grid', label: 'Grid' },
  { key: 'dots', label: 'Dots' },
  { key: 'diagonal', label: 'Diagonal' },
  { key: 'crosshatch', label: 'Crosshatch' },
  { key: 'hexagons', label: 'Hexagons' },
  { key: 'rings', label: 'Rings' },
  { key: 'diamonds', label: 'Diamonds' },
];

function CodeString({ config }: { config: BgConfig }) {
  const lines: string[] = [`<BgRenderer`];
  lines.push(`  config={{`);
  lines.push(`    gradient: { enabled: ${config.gradient.enabled}, type: "${config.gradient.type}", color1: "${config.gradient.color1}", color2: "${config.gradient.color2}", color3: "${config.gradient.color3}", angle: ${config.gradient.angle}, opacity: ${config.gradient.opacity} },`);
  const activePatterns = PATTERN_LIST.filter(({ key }) => config.patterns[key].enabled);
  if (activePatterns.length > 0) {
    lines.push(`    patterns: {`);
    for (const { key } of activePatterns) {
      const p = config.patterns[key];
      lines.push(`      ${key}: { enabled: true, color: "${p.color}", opacity: ${p.opacity}, size: ${p.size}, strokeWidth: ${p.strokeWidth}${'angle' in p ? `, angle: ${(p as any).angle}` : ''} },`);
    }
    lines.push(`    },`);
  }
  lines.push(`    waves: { enabled: ${config.waves.enabled}, color: "${config.waves.color}", opacity: ${config.waves.opacity}, amplitude: ${config.waves.amplitude}, frequency: ${config.waves.frequency}, speed: ${config.waves.speed}, count: ${config.waves.count} },`);
  lines.push(`    blobs: { enabled: ${config.blobs.enabled}, color1: "${config.blobs.color1}", color2: "${config.blobs.color2}", opacity: ${config.blobs.opacity}, count: ${config.blobs.count}, animation: "${config.blobs.animation}", speed: ${config.blobs.speed}, size: ${config.blobs.size} },`);
  lines.push(`  }}`);
  lines.push(`/>`);
  return <>{lines.join('\n')}</>;
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" className="w-9 h-9 p-0.5 border rounded cursor-pointer" value={value} onChange={(e) => onChange(e.target.value)} />
        <input type="text" className="flex-1 rounded border border-gray-300 p-1.5 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function RangeInput({ label, value, min, max, step, onChange, unit }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}: {value}{unit || ''}</label>
      <input type="range" min={min} max={max} step={step} className="w-full" value={value} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <select className="w-full rounded-lg border border-gray-300 p-2 text-sm bg-white" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 text-sm cursor-pointer py-1">
      <span className="font-medium">{label}</span>
      <button
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
        onClick={() => onChange(!enabled)}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
          style={{ transform: `translateX(${enabled ? 18 : 2}px)` }}
        />
      </button>
    </label>
  );
}

export function BgControls() {
  const [config, setConfig] = useState<BgConfig>(DEFAULT_CONFIG);
  const [savedPresets, setSavedPresets] = useState<BgPreset[]>([]);
  const [showCode, setShowCode] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);

  useEffect(() => { setSavedPresets(loadSavedPresets()); }, []);

  const update = <K extends keyof BgConfig>(key: K, value: BgConfig[K]) => setConfig((prev) => ({ ...prev, [key]: value }));
  const updateGradient = <K extends keyof BgConfig['gradient']>(key: K, value: BgConfig['gradient'][K]) => setConfig((prev) => ({ ...prev, gradient: { ...prev.gradient, [key]: value } }));
  const updatePattern = (name: BgPatternType, patch: Partial<BgConfig['patterns'][BgPatternType]>) => setConfig((prev) => ({ ...prev, patterns: { ...prev.patterns, [name]: { ...prev.patterns[name], ...patch } } }));
  const updateWaves = <K extends keyof BgConfig['waves']>(key: K, value: BgConfig['waves'][K]) => setConfig((prev) => ({ ...prev, waves: { ...prev.waves, [key]: value } }));
  const updateBlobs = <K extends keyof BgConfig['blobs']>(key: K, value: BgConfig['blobs'][K]) => setConfig((prev) => ({ ...prev, blobs: { ...prev.blobs, [key]: value } }));

  const applyPreset = (preset: BgPreset) => setConfig({ ...preset.config });

  const handleSave = () => {
    if (!saveName.trim()) return;
    saveCustomPreset(saveName.trim(), config);
    setSavedPresets(loadSavedPresets());
    setSaveName('');
    setShowSave(false);
  };

  const handleDelete = (id: string) => {
    deleteCustomPreset(id);
    setSavedPresets(loadSavedPresets());
  };

  const anyPatternEnabled = PATTERN_LIST.some(({ key }) => config.patterns[key].enabled);

  return (
    <div className="flex h-dvh bg-white text-gray-800 font-sans">
      <div className="w-80 shrink-0 flex flex-col border-r border-gray-200 bg-gray-50">
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <h2 className="text-lg font-semibold">Background Studio</h2>

          {/* ── Layer Toggles ── */}
          <div className="space-y-1 border-b border-gray-200 pb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Layers</h3>
            <Toggle label="Gradient" enabled={config.gradient.enabled} onChange={(v) => updateGradient('enabled', v)} />
            <Toggle label="Waves" enabled={config.waves.enabled} onChange={(v) => updateWaves('enabled', v)} />
            <Toggle label="Blobs" enabled={config.blobs.enabled} onChange={(v) => updateBlobs('enabled', v)} />
          </div>

          {/* ── Pattern Toggles ── */}
          <div className="space-y-1 border-b border-gray-200 pb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Pattern Overlays</h3>
            {PATTERN_LIST.map(({ key, label }) => (
              <Toggle key={key} label={label} enabled={config.patterns[key].enabled} onChange={(v) => updatePattern(key, { enabled: v } as any)} />
            ))}
          </div>

          {/* ── Gradient ── */}
          {config.gradient.enabled && (
            <div className="space-y-3 border-b border-gray-200 pb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Gradient Settings</h3>
              <SelectInput label="Type" value={config.gradient.type} options={GRADIENT_TYPES} onChange={(v) => updateGradient('type', v as any)} />
              <ColorInput label="Color 1" value={config.gradient.color1} onChange={(v) => updateGradient('color1', v)} />
              <ColorInput label="Color 2" value={config.gradient.color2} onChange={(v) => updateGradient('color2', v)} />
              <ColorInput label="Color 3" value={config.gradient.color3} onChange={(v) => updateGradient('color3', v)} />
              <RangeInput label="Angle" value={config.gradient.angle} min={0} max={360} step={1} onChange={(v) => updateGradient('angle', v)} unit="deg" />
              <RangeInput label="Opacity" value={config.gradient.opacity} min={0} max={1} step={0.01} onChange={(v) => updateGradient('opacity', v)} />
            </div>
          )}

          {/* ── Pattern Settings ── */}
          {anyPatternEnabled && (
            <div className="space-y-3 border-b border-gray-200 pb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pattern Settings</h3>
              {PATTERN_LIST.map(({ key, label }) => {
                const p = config.patterns[key];
                if (!p.enabled) return null;
                return (
                  <div key={key} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white">
                    <h4 className="text-sm font-semibold">{label}</h4>
                    <ColorInput label="Color" value={p.color} onChange={(v) => updatePattern(key, { color: v } as any)} />
                    <RangeInput label="Opacity" value={p.opacity} min={0} max={1} step={0.01} onChange={(v) => updatePattern(key, { opacity: v } as any)} unit="" />
                    <RangeInput label="Size" value={p.size} min={8} max={120} step={1} onChange={(v) => updatePattern(key, { size: v } as any)} unit="px" />
                    <RangeInput label="Stroke" value={p.strokeWidth} min={0.1} max={3} step={0.1} onChange={(v) => updatePattern(key, { strokeWidth: v } as any)} unit="px" />
                    {'angle' in p && (
                      <RangeInput label="Angle" value={(p as any).angle} min={0} max={360} step={1} onChange={(v) => updatePattern(key, { angle: v } as any)} unit="deg" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Waves ── */}
          {config.waves.enabled && (
            <div className="space-y-3 border-b border-gray-200 pb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Waves Settings</h3>
              <ColorInput label="Color" value={config.waves.color} onChange={(v) => updateWaves('color', v)} />
              <RangeInput label="Opacity" value={config.waves.opacity} min={0} max={1} step={0.01} onChange={(v) => updateWaves('opacity', v)} />
              <RangeInput label="Amplitude" value={config.waves.amplitude} min={5} max={50} step={1} onChange={(v) => updateWaves('amplitude', v)} unit="px" />
              <RangeInput label="Frequency" value={config.waves.frequency} min={0.5} max={5} step={0.5} onChange={(v) => updateWaves('frequency', v)} />
              <RangeInput label="Speed" value={config.waves.speed} min={0.2} max={3} step={0.1} onChange={(v) => updateWaves('speed', v)} unit="x" />
              <RangeInput label="Count" value={config.waves.count} min={1} max={6} step={1} onChange={(v) => updateWaves('count', v)} />
            </div>
          )}

          {/* ── Blobs ── */}
          {config.blobs.enabled && (
            <div className="space-y-3 border-b border-gray-200 pb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Blobs Settings</h3>
              <ColorInput label="Color 1" value={config.blobs.color1} onChange={(v) => updateBlobs('color1', v)} />
              <ColorInput label="Color 2" value={config.blobs.color2} onChange={(v) => updateBlobs('color2', v)} />
              <RangeInput label="Opacity" value={config.blobs.opacity} min={0} max={0.5} step={0.01} onChange={(v) => updateBlobs('opacity', v)} />
              <RangeInput label="Count" value={config.blobs.count} min={2} max={4} step={1} onChange={(v) => updateBlobs('count', v as any)} />
              <SelectInput label="Animation" value={config.blobs.animation} options={ANIM_OPTIONS} onChange={(v) => updateBlobs('animation', v as any)} />
              {config.blobs.animation !== 'none' && (
                <>
                  <RangeInput label="Speed" value={config.blobs.speed} min={0.2} max={3} step={0.1} onChange={(v) => updateBlobs('speed', v)} unit="x" />
                  <RangeInput label="Size" value={config.blobs.size} min={0.5} max={2.5} step={0.1} onChange={(v) => updateBlobs('size', v)} unit="x" />
                </>
              )}
            </div>
          )}

          <div className="border-t border-gray-200 pt-4 space-y-2">
            <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm" onClick={() => setConfig({ ...DEFAULT_CONFIG })}>
              Reset to Defaults
            </button>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Save Preset</h3>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-lg border border-gray-300 p-2 text-sm"
                placeholder="Preset name..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <button className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm" onClick={handleSave}>
                Save
              </button>
            </div>
          </div>

          {savedPresets.length > 0 && (
            <div className="border-t border-gray-200 pt-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">Saved Presets</h3>
              <div className="grid grid-cols-2 gap-2">
                {savedPresets.map((preset) => (
                  <button
                    key={preset.id}
                    className="group relative flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50 text-sm text-left transition-colors"
                    onClick={() => applyPreset(preset)}
                  >
                    <span className="text-lg">{preset.icon}</span>
                    <span className="flex-1 truncate">{preset.name}</span>
                    <span
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleDelete(preset.id); }}
                    >
                      ×
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-200 bg-white">
          <button
            className="flex items-center justify-between w-full px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900"
            onClick={() => setShowCode(!showCode)}
          >
            <span className="font-medium">Generated Code</span>
            <div className="flex items-center gap-2">
              <span
                className="text-xs px-2 py-1 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors"
                onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(document.querySelector('.code-block')?.textContent || ''); }}
              >
                Copy
              </span>
              <span className="material-symbols-outlined text-lg transition-transform" style={{ transform: showCode ? 'rotate(180deg)' : 'none' }}>
                expand_more
              </span>
            </div>
          </button>
          {showCode && (
            <div className="px-4 pb-4">
              <pre className="code-block overflow-x-auto text-xs text-gray-100 leading-relaxed bg-gray-900 p-3 rounded-lg">
                <code><CodeString config={config} /></code>
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <BgRenderer config={config} absolute />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-8  text-center">
            <h1 className="text-2xl font-bold text-gray-800">Your content here</h1>
            <p className="text-gray-500 mt-2">Adjust controls to see the background change.</p>
          </div>
        </div>
        <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded pointer-events-none">
          Live preview
        </div>
      </div>
    </div>
  );
}
