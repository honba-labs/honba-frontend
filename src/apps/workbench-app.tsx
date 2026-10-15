import React, { useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

import '../styles/theme.css';
import '../styles/base.css';
import '../styles/components.css';

import { themeEngine } from '../core/theme-engine';
import { AppShell } from '../layouts/app-shell';
import { HonbaClient } from '../core/api/generated/client';
import { useWorkbenchStore } from '../core/workbench/store';
import { WorkbenchToolbar } from '../components/features/workbench/workbench-toolbar';
import { MultiChartGrid } from '../components/features/workbench/multi-chart-grid';
import { OrderTicket } from '../components/features/workbench/order-ticket';
import { TradingDrawer } from '../components/features/workbench/trading-drawer';

export const WorkbenchApp: React.FC = () => {
  const client = useMemo(() => new HonbaClient({}), []);
  const { fetchState } = useWorkbenchStore();

  useEffect(() => {
    themeEngine.applyToDOM();
    void fetchState(client);
  }, [client, fetchState]);

  return (
    <AppShell currentAppId="workbench">
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          background: 'var(--bg-app)',
          overflow: 'hidden',
        }}
      >
        <WorkbenchToolbar client={client} />

        <div
          style={{
            flex: 1,
            display: 'flex',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <MultiChartGrid />
          <OrderTicket client={client} />
        </div>

        <TradingDrawer client={client} />
      </main>
    </AppShell>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<WorkbenchApp />);
}
