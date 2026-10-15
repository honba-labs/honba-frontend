import React from 'react';
import { useWorkbenchStore } from '../../../core/workbench/store';
import { ChartPaneCard } from './chart-pane-card';
import { layoutById } from '../../../lib/chart/layouts';

export const MultiChartGrid: React.FC = () => {
  const { layout, panes, activePaneIndex } = useWorkbenchStore();

  // Normalize legacy layout ids if present
  const normLayoutId =
    layout === '1x1'
      ? 'single'
      : layout === '1x2'
      ? 'cols2'
      : layout === '2x1'
      ? 'rows2'
      : layout === '2x2'
      ? 'grid4'
      : layout;

  const preset = layoutById(normLayoutId);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gap: 6,
        padding: 6,
        boxSizing: 'border-box',
        overflow: 'hidden',
        gridTemplateColumns: preset.cols,
        gridTemplateRows: preset.rows,
        gridTemplateAreas: preset.areas,
      }}
    >
      {preset.cells.map((cell, idx) => {
        const pane = panes[idx] ?? panes[0];
        return (
          <div
            key={`${preset.id}-${cell}-${pane.id}`}
            style={{
              gridArea: cell,
              display: 'flex',
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            <ChartPaneCard
              pane={pane}
              index={idx}
              isActive={activePaneIndex === idx}
            />
          </div>
        );
      })}
    </div>
  );
};
