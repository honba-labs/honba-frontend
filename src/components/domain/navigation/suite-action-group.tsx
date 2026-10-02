import React from 'react';
import { LineChart, ExternalLink, Code2, FlaskConical, Play } from 'lucide-react';

export interface SuiteActionGroupProps {
  symbol: string;
  variant?: 'stacked' | 'inline';
  className?: string;
}

export const SuiteActionGroup: React.FC<SuiteActionGroupProps> = ({
  symbol,
  variant = 'stacked',
  className = '',
}) => {
  const encSym = encodeURIComponent(symbol);

  if (variant === 'inline') {
    return (
      <div className={`inst-hero-actions ${className}`}>
        <a
          href={`/workbench.html?symbol=${encSym}`}
          className="inst-action-btn inst-btn-primary"
          title={`Open full interactive charting in WorkBench for ${symbol}`}
        >
          <span>WorkBench</span>
          <ExternalLink size={13} />
        </a>

        <a
          href={`/algodesigner.html?symbol=${encSym}`}
          className="inst-action-btn inst-btn-secondary"
          title={`Strategy Composer for ${symbol}`}
        >
          <Code2 size={13} />
          <span>Algo-Designer</span>
        </a>

        <a
          href={`/researcher.html?symbol=${encSym}`}
          className="inst-action-btn inst-btn-secondary"
          title={`Financial & quantitative research on ${symbol}`}
        >
          <FlaskConical size={13} />
          <span>Research</span>
        </a>

        <a
          href={`/simulator.html?symbol=${encSym}`}
          className="inst-action-btn inst-btn-secondary"
          title={`Run Nautilus tick-level backtest for ${symbol}`}
        >
          <Play size={13} />
          <span>Backtest</span>
        </a>
      </div>
    );
  }

  // Stacked variant (for Screener Detail Drawer and Side Panels)
  return (
    <div className={`drawer-action-top-group ${className}`}>
      <a
        href={`/workbench.html?symbol=${encSym}`}
        target="_blank"
        rel="noopener noreferrer"
        className="shortlist-btn shortlist-btn-primary"
        style={{
          width: '100%',
          justifyContent: 'center',
          padding: '8px 12px',
          fontSize: 12.5,
          textDecoration: 'none',
          background: 'var(--accent-primary)',
          color: '#ffffff',
          fontWeight: 600,
          borderRadius: 'var(--radius-xs, 4px)',
        }}
        title={`Open ${symbol} in WorkBench Terminal`}
      >
        <LineChart size={13} style={{ marginRight: 6 }} />
        <span>Open in WorkBench</span>
        <ExternalLink size={12} style={{ marginLeft: 6, opacity: 0.8 }} />
      </a>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, width: '100%' }}>
        <a
          href={`/algodesigner.html?symbol=${encSym}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shortlist-btn shortlist-btn-secondary"
          style={{
            justifyContent: 'center',
            padding: '6px 4px',
            textDecoration: 'none',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 'var(--radius-xs, 4px)',
            whiteSpace: 'nowrap',
          }}
          title={`Compose automated strategy for ${symbol}`}
        >
          <Code2 size={12} style={{ marginRight: 4, flexShrink: 0 }} />
          <span>Algo-Designer</span>
        </a>
        <a
          href={`/researcher.html?symbol=${encSym}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shortlist-btn shortlist-btn-secondary"
          style={{
            justifyContent: 'center',
            padding: '6px 4px',
            textDecoration: 'none',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 'var(--radius-xs, 4px)',
            whiteSpace: 'nowrap',
          }}
          title={`Financial & quantitative research on ${symbol}`}
        >
          <FlaskConical size={12} style={{ marginRight: 4, flexShrink: 0 }} />
          <span>Research</span>
        </a>
        <a
          href={`/simulator.html?symbol=${encSym}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shortlist-btn shortlist-btn-secondary"
          style={{
            justifyContent: 'center',
            padding: '6px 4px',
            textDecoration: 'none',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 'var(--radius-xs, 4px)',
            whiteSpace: 'nowrap',
          }}
          title={`Tick-level Nautilus backtest simulation for ${symbol}`}
        >
          <Play size={11} style={{ marginRight: 4, flexShrink: 0 }} />
          <span>Backtest</span>
        </a>
      </div>
    </div>
  );
};
