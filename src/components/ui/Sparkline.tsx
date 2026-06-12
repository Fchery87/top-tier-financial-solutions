import * as React from 'react';
import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** Stroke color via currentColor by default; pass a token class on the wrapper. */
  className?: string;
  strokeWidth?: number;
  /** Fill a subtle area under the line. */
  fill?: boolean;
}

/**
 * Dependency-free inline sparkline. Inherits `currentColor`, so color it by
 * setting a text-* class on the element (e.g. text-up / text-down).
 */
export function Sparkline({
  data,
  width = 72,
  height = 24,
  className,
  strokeWidth = 1.5,
  fill = true,
}: SparklineProps) {
  if (!data || data.length < 2) {
    return <svg width={width} height={height} className={className} aria-hidden="true" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pad = strokeWidth;

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('overflow-visible', className)}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {fill && <path d={area} fill="currentColor" opacity={0.1} />}
      <path d={line} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
