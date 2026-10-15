import React from 'react';
import { useWorkbenchStore } from '../../../core/workbench/store';
import { ChartPaneCard } from './chart-pane-card';

export const MultiChartGrid: React.FC = () => {
  const { layout, panes, activePaneIndex } = useWorkbenchStore();

  const getGridStyle = (): React.CSSProperties => {
    switch (layout) {
      case '1x1':
        return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr' };
      case '1x2':
        return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
      case '2x1':
        return { gridTemplateColumns: '1fr', gridTemplateRows: '1fr 1fr' };
      case '2x2':
        return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr' };
      default:
        return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr' };
    }
  };

  const visibleCount = layout === '1x1' ? 1 : layout === '2x2' ? 4 : 2;
  const visiblePanes = panes.slice(0, visibleCount);

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gap: 8,
        padding: 8,
        boxSizing: 'border-box',
        overflow: 'hidden',
        ...getGridStyle(),
      }}
    >
      {visiblePanes.map((pane, idx) => (
        <ChartPaneCard
          key={pane.id}
          pane={pane}
          index={idx}
          isActive={activePaneIndex === idx}
        />
      ))}
    </div>
  );
};
