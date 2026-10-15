import React from 'react';

export interface LayoutPreset {
  id: string;
  label: string;
  cols: string;
  rows: string;
  areas: string;
  cells: string[];
}

export const OPENALGO_LAYOUTS: LayoutPreset[] = [
  { id: 'single', label: 'Single', cols: '1fr', rows: '1fr', areas: '"a"', cells: ['a'] },
  {
    id: 'cols2',
    label: '2 Columns',
    cols: '1fr 1fr',
    rows: '1fr',
    areas: '"a b"',
    cells: ['a', 'b'],
  },
  {
    id: 'rows2',
    label: '2 Rows',
    cols: '1fr',
    rows: '1fr 1fr',
    areas: '"a" "b"',
    cells: ['a', 'b'],
  },
  {
    id: 'oneTwo',
    label: '1 + 2 (Master & Dual)',
    cols: '1.4fr 1fr',
    rows: '1fr 1fr',
    areas: '"a b" "a c"',
    cells: ['a', 'b', 'c'],
  },
  {
    id: 'grid4',
    label: '2 × 2 Quad',
    cols: '1fr 1fr',
    rows: '1fr 1fr',
    areas: '"a b" "c d"',
    cells: ['a', 'b', 'c', 'd'],
  },
];

export function layoutById(id: string | null | undefined): LayoutPreset {
  return OPENALGO_LAYOUTS.find((p) => p.id === id) ?? OPENALGO_LAYOUTS[0];
}

export const LayoutIcon: React.FC<{ preset: LayoutPreset; className?: string }> = ({ preset }) => {
  return (
    <span
      style={{
        display: 'grid',
        width: 16,
        height: 16,
        gap: 1.5,
        gridTemplateColumns: preset.cols,
        gridTemplateRows: preset.rows,
        gridTemplateAreas: preset.areas,
      }}
      aria-hidden="true"
    >
      {preset.cells.map((c) => (
        <span
          key={c}
          style={{
            gridArea: c,
            borderRadius: 1,
            backgroundColor: 'currentColor',
            opacity: 0.85,
          }}
        />
      ))}
    </span>
  );
};
