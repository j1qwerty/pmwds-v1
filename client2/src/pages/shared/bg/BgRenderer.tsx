import React from 'react';
import type { BgConfig } from './types';
import { buildGradientStyle, buildPatternStyles, getAnimStyle, ANIM_KEYFRAMES, hexToRgba } from './utils';

interface WavesSvgProps {
  color: string;
  sw: number;
  amplitude: number;
  frequency: number;
  count: number;
}

function WavesSvg({ color, sw, amplitude, frequency, count }: WavesSvgProps) {
  const w = 600;
  const h = amplitude * 2 * count + sw * 2;
  const paths = Array.from({ length: count }, (_, i) => {
    const baseY = amplitude + sw + i * amplitude * 2;
    let d = `M0 ${baseY}`;
    for (let x = 0; x <= w; x += 1) {
      const y = baseY + amplitude * Math.sin((x / w) * Math.PI * 2 * frequency + i * 0.8);
      d += ` L${x} ${y.toFixed(2)}`;
    }
    return <path key={i} d={d} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" opacity={0.4 + i * 0.2} />;
  });
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {paths}
    </svg>
  );
}

interface BgRendererProps {
  config: BgConfig;
  absolute?: boolean;
}

export function BgRenderer({ config, absolute }: BgRendererProps) {
  const pos = absolute ? 'absolute' : 'fixed';
  const { gradient, waves, blobs } = config;

  const gradientStyle = gradient.enabled ? buildGradientStyle(gradient) : null;
  const patternStyles = buildPatternStyles(config);

  return (
    <>
      {gradientStyle && (
        <div className={`${pos} inset-0 pointer-events-none z-0`} style={gradientStyle} />
      )}

      {patternStyles.map((ps, idx) => (
        <div
          key={idx}
          className={`${pos} inset-0 pointer-events-none z-0`}
          style={{ backgroundImage: ps.backgroundImage, backgroundRepeat: 'repeat' }}
        />
      ))}

      {waves.enabled && (
        <div className={`${pos} inset-0 pointer-events-none z-0 overflow-hidden`} style={{ opacity: waves.opacity }}>
          <div
            className="absolute"
            style={{
              width: '200%',
              bottom: 0,
              left: 0,
              animation: `bg-wave ${20 / waves.speed}s linear infinite`,
            }}
          >
            <WavesSvg color={hexToRgba(waves.color, 1)} sw={1.5} amplitude={waves.amplitude} frequency={waves.frequency} count={waves.count} />
          </div>
        </div>
      )}

      {blobs.enabled && blobs.opacity > 0 &&
        Array.from({ length: blobs.count }, (_, i) => {
          const positions = [
            { top: '10%', right: '5%' },
            { bottom: '10%', left: '5%' },
            { top: '40%', left: '30%' },
            { bottom: '30%', right: '20%' },
          ];
          const p = positions[i % positions.length];
          const sz = (280 + i * 40) * blobs.size;
          return (
            <div
              key={i}
              className={`${pos} rounded-full pointer-events-none z-0`}
              style={{
                ...p,
                width: sz,
                height: sz,
                filter: 'blur(80px)',
                backgroundColor: i % 2 === 0 ? blobs.color1 : blobs.color2,
                opacity: i === 2 ? blobs.opacity * 0.6 : blobs.opacity,
                ...getAnimStyle(blobs.animation, blobs.speed, i),
              }}
            />
          );
        })}

      <style>{ANIM_KEYFRAMES}</style>
    </>
  );
}
