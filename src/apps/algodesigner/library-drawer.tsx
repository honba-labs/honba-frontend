import React, { useMemo, useState } from 'react';
import { Boxes, Copy, FilePlus2, Play, Search, Trash2, Upload } from 'lucide-react';

import { catalogue } from '../../core/graph/catalogue';
import {
  filterLibrary,
  mergeLibrary,
  presentCategories,
  type LibraryEntry,
  type SavedStrategyManifest,
  type StrategyCategory,
  type StrategyTemplate,
} from '../../core/designer/library-store';

/**
 * Strategy & indicator library drawer (Phase 5, HBD-2026-DES-004).
 *
 * Two strategies sections — built-in templates and the user's saved strategies —
 * with search and a category filter, plus the indicator catalogue grouped by
 * family. Rows offer Open (load graph + regenerate code), Simulate (hand off to
 * the Simulator) and, for custom strategies, Fork and Delete.
 */

export interface LibraryDrawerProps {
  templates: ReadonlyArray<StrategyTemplate>;
  saved: ReadonlyArray<SavedStrategyManifest>;
  onNewStrategy: () => void;
  onAddIndicator?: (kind: string) => void;
  onOpen: (graph: LibraryEntry['graph']) => void;
  onSimulate: (graph: LibraryEntry['graph']) => void;
  onFork: (manifest: SavedStrategyManifest) => void;
  onDelete: (id: string) => void;
}

export const LibraryDrawer: React.FC<LibraryDrawerProps> = ({
  templates,
  saved,
  onNewStrategy,
  onAddIndicator,
  onOpen,
  onSimulate,
  onFork,
  onDelete,
}) => {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<StrategyCategory | 'all'>('all');
  const [family, setFamily] = useState<string>('all');

  const catalog = catalogue();
  const entries = useMemo(() => mergeLibrary(templates, saved), [templates, saved]);
  const categories = useMemo(() => presentCategories(entries), [entries]);
  const strategies = useMemo(() => filterLibrary(entries, { query: search, category }), [entries, search, category]);

  const indicators = useMemo(() => {
    const term = search.trim().toLowerCase();
    return catalog.indicators.filter((entry) => {
      const matchesFamily = family === 'all' || entry.family === family;
      const matchesTerm = !term || entry.kind.toLowerCase().includes(term) || entry.family.toLowerCase().includes(term);
      return matchesFamily && matchesTerm;
    });
  }, [catalog.indicators, family, search]);

  const renderStrategy = (entry: LibraryEntry, index: number) => (
    <li key={`${entry.source}-${entry.id}-${index}`}>
      <div
        style={{
          border: '1px solid var(--border-subtle, #2a2e39)',
          borderRadius: 'var(--radius-sm, 4px)',
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: 'var(--text-primary)', fontSize: 12, fontWeight: 600 }}>{entry.name}</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{entry.category.replace('/', ' / ')}</span>
        </div>
        {entry.description ? (
          <span style={{ fontSize: 10.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{entry.description}</span>
        ) : null}
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="shortlist-btn shortlist-btn-primary"
            onClick={() => onOpen(entry.graph)}
            title={`Open ${entry.name} on the canvas`}
            style={{ fontSize: 10, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Upload size={11} /> Open
          </button>
          <button
            type="button"
            className="shortlist-btn"
            onClick={() => onSimulate(entry.graph)}
            title={`Open the Simulator with ${entry.name}`}
            style={{ fontSize: 10, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Play size={11} /> Simulate
          </button>
          {entry.source === 'custom' && entry.manifest ? (
            <>
              <button
                type="button"
                className="shortlist-btn"
                onClick={() => onFork(entry.manifest as SavedStrategyManifest)}
                title="Duplicate into a new variant"
                style={{ fontSize: 10, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Copy size={11} /> Fork
              </button>
              <button
                type="button"
                className="shortlist-btn"
                onClick={() => onDelete(entry.id)}
                title="Delete this saved strategy"
                style={{ fontSize: 10, padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--bearish, #f23645)' }}
              >
                <Trash2 size={11} />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );

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
            placeholder="Search strategies & indicators…"
            aria-label="Search library"
            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12, flex: 1 }}
          />
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <button
            type="button"
            className={category === 'all' ? 'shortlist-btn shortlist-btn-primary' : 'shortlist-btn'}
            onClick={() => setCategory('all')}
            style={{ fontSize: 10, padding: '2px 6px' }}
          >
            All strategies
          </button>
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              className={category === name ? 'shortlist-btn shortlist-btn-primary' : 'shortlist-btn'}
              onClick={() => setCategory(name)}
              style={{ fontSize: 10, padding: '2px 6px' }}
            >
              {name.replace('/', ' / ')}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            <Boxes size={12} />
            <span>Strategies ({strategies.length})</span>
          </div>
          {strategies.length === 0 ? (
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>No strategies match. Save one with the top-bar Save button.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {strategies.map(renderStrategy)}
            </ul>
          )}
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            <Boxes size={12} />
            <span>Indicators ({indicators.length})</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
            <button
              type="button"
              className={family === 'all' ? 'shortlist-btn shortlist-btn-primary' : 'shortlist-btn'}
              onClick={() => setFamily('all')}
              style={{ fontSize: 10, padding: '2px 6px' }}
            >
              All
            </button>
            {catalog.families.map((name) => (
              <button
                key={name}
                type="button"
                className={family === name ? 'shortlist-btn shortlist-btn-primary' : 'shortlist-btn'}
                onClick={() => setFamily(name)}
                style={{ fontSize: 10, padding: '2px 6px' }}
              >
                {name.replace(/_/g, ' ')}
              </button>
            ))}
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
        </div>
      </div>
    </div>
  );
};
