export type { BgConfig, BgPreset, BgPatternType, BgPatternConfig, BgDiagonalPatternConfig, BgAnimation, BgGradientType } from './types';
export { BgRenderer } from './BgRenderer';
export { BgControls } from './BgControls';
export { DEFAULT_CONFIG, BUILTIN_PRESETS, loadSavedPresets, saveCustomPreset, deleteCustomPreset } from './presets';
export { hexToRgba, buildGradientStyle, buildPatternStyles } from './utils';
