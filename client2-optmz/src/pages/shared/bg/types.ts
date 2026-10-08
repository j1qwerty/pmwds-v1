export type BgAnimation = 'none' | 'float' | 'pulse' | 'rotate' | 'drift' | 'breathe';

export type BgGradientType = 'radial' | 'linear' | 'conic';

export type BgPatternType = 'grid' | 'dots' | 'diagonal' | 'crosshatch' | 'hexagons' | 'rings' | 'diamonds';

export interface BgPatternConfig {
  enabled: boolean;
  color: string;
  opacity: number;
  size: number;
  strokeWidth: number;
}

export interface BgDiagonalPatternConfig extends BgPatternConfig {
  angle: number;
}

export interface BgConfig {
  gradient: {
    enabled: boolean;
    type: BgGradientType;
    color1: string;
    color2: string;
    color3: string;
    angle: number;
    opacity: number;
  };
  patterns: {
    grid: BgPatternConfig;
    dots: BgPatternConfig;
    diagonal: BgDiagonalPatternConfig;
    crosshatch: BgDiagonalPatternConfig;
    hexagons: BgPatternConfig;
    rings: BgPatternConfig;
    diamonds: BgPatternConfig;
  };
  waves: {
    enabled: boolean;
    color: string;
    opacity: number;
    amplitude: number;
    frequency: number;
    speed: number;
    count: number;
  };
  blobs: {
    enabled: boolean;
    color1: string;
    color2: string;
    opacity: number;
    count: 2 | 3 | 4;
    animation: BgAnimation;
    speed: number;
    size: number;
  };
}

export interface BgPreset {
  id: string;
  name: string;
  icon: string;
  config: BgConfig;
}
