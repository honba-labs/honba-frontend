import React from 'react';
import { useWorkbenchStore } from '../../../core/workbench/store';
import type { ChartPaneConfig } from '../../../core/workbench/types';
import { OpenAlgoChart } from './openalgo-chart';

interface ChartPaneCardProps {
  pane: ChartPaneConfig;
  index: number;
  isActive: boolean;
}

export const ChartPaneCard: React.FC<ChartPaneCardProps> = ({ pane, index, isActive }) => {
  const { setActivePane, updatePane } = useWorkbenchStore();

  return (
    <div
      onClick={() => setActivePane(index)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-surface)',
        borderRadius: 4,
        border: isActive ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
        overflow: 'hidden',
        minHeight: 0,
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        boxShadow: isActive ? '0 0 0 1px var(--accent-primary)' : 'none',
        position: 'relative',
      }}
    >
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <OpenAlgoChart
          symbol={pane.symbol}
          timeframe={pane.timeframe}
          chartMode={pane.chartMode}
          onSymbolChange={(newSym) => updatePane(index, { symbol: newSym })}
          onIntervalChange={(newInt) => updatePane(index, { timeframe: newInt })}
          showRail={true}
        />
      </div>
    </div>
  );
};
