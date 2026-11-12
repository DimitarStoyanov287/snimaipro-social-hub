import type { CSSProperties } from 'react';

export const CHART = {
  yellow: '#F2C314',
  green: '#5FBF9F',
  pink: '#EAA7C7',
  orange: '#ED773C',
  cream: '#EAE4DA',
  grid: 'rgba(234,228,218,0.10)',
  tick: '#B9B3A7',
};

export const axisProps = {
  tick: { fill: CHART.tick, fontSize: 12 },
  stroke: CHART.grid,
  tickLine: false,
} as const;

export const tooltipStyle: { contentStyle: CSSProperties; labelStyle: CSSProperties; itemStyle: CSSProperties; cursor: object } = {
  contentStyle: { background: '#121210', border: '1px solid rgba(234,228,218,0.2)', borderRadius: 12, color: '#EAE4DA', fontSize: 13 },
  labelStyle: { color: '#EAE4DA', fontWeight: 600 },
  itemStyle: { color: '#EAE4DA' },
  cursor: { stroke: 'rgba(234,228,218,0.3)' },
};
