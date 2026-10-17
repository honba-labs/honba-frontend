import React, { useMemo, useState } from 'react';
import { Boxes, FilePlus2, Search } from 'lucide-react';

import { catalogue } from '../../core/graph/catalogue';

/**
 * Strategy & indicator library drawer (Phase 1 shell; full catalogue in Phase 5).
 *
 * Phase 1 renders the indicator catalogue that is already available in the
 * frontend bundle (`core/graph/catalogue.ts`, mirrored from the registered Python
 * indicators) and a "New Strategy" affordance. Phase 5 adds the strategy registry
 * (`honba-strategies/registry.json` via `GET /strategies`), user-saved manifests,
 * save/versioning and the Simulate action per row.
 */

export interface LibraryDrawerProps {
  onNewStrategy: () => void;
  onAddIndicator?: (kind: string) => void;
}

export const LibraryDrawer: React.FC<LibraryDrawerProps> = ({ onNewStrategy, onAddIndicator }) => {
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState<string>('all');

  const catalog = catalogue();
  const families = catalog.families;

  const indicators = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalog.indicators.filter((entry) => {
      const matchesFamily = family === 'all' || entry.family === family;
      const matchesTerm = !term || entry.kind.toLowerCase().includes(term) || entry.family.toLowerCase().includes(term);
      return matchesFamily && matchesTerm;
    });
  }, [catalog.indicators, family, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--border-subtle, #2a2e39)' }}>
        <button
          type="button"
          className="shortlist-btn shortlist-btn-primary"
          onClick={onNewStrategy}
          style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', padding: '6px 8px' }}
        >
          <FilePlus2 size={13} />
          <span>New Strategy</span>
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-surface-elevated, #2a2e39)', borderRadius: 'var(--radius-sm, 4px)', padding: '3px 8px' }}>
          <Search size={12} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search indicators…"
            aria-label="Search indicators"
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12, flex: 1 }}
          />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <button
            type="button"
            className="shortlist-btn"
            onClick={() => setFamily('all')}
            style={{ fontSize: 10, padding: '2px 6px', color: family === 'all' ? 'var(--accent-primary, #2962ff)' : undefined }}
          >
            All
          </button>
          {families.map((name) => (
            <button
              key={name}
              type="button"
              className="shortlist-btn"
              onClick={() => setFamily(name)}
              style={{ fontSize: 10, padding: '2px 6px', color: family === name ? 'var(--accent-primary, #2962ff)' : undefined }}
            >
              {name.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          <Boxes size={12} />
          <span>Indicators ({indicators.length})</span>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {indicators.map((entry) => (
            <li key={entry.kind}>
              <button
                type="button"
                className="shortlist-btn"
                onClick={() => onAddIndicator?.(entry.kind)}
                disabled={!onAddIndicator}
                title={onAddIndicator ? `Add ${entry.kind} node to the canvas` : entry.summary}
                style={{ width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 6px', fontSize: 12 }}
              >
                <span style={{ color: 'var(--text-primary)' }}>{entry.kind}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{entry.family}</span>
              </button>
            </li>
          ))}
        </ul>
        <p style={{ marginTop: 14, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Strategy catalogue, user-saved strategies and one-click Simulate land in Phase 5
          (registry <code>GET /strategies</code>).
        </p>
      </div>
    </div>
  );
};
