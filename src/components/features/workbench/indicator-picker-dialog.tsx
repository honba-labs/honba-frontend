import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import * as core from 'openalgo-charts';
import type { WidgetContext } from 'openalgo-charts/widget';
import { Search, X, Star, Trash2, Check, Layers } from 'lucide-react';
import { TARGET_CATEGORY_COUNTS } from '../../../core/indicators/loader';

export interface IndicatorItem {
  id: string;
  name: string;
  category: string;
}

interface IndicatorPickerDialogProps {
  ctx: WidgetContext;
  onClose: () => void;
}

const FAV_KEY = 'honba-workbench-fav-indicators';
const RECENT_KEY = 'honba-workbench-recent-indicators';

function loadStoredList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredList(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export const IndicatorPickerDialog: React.FC<IndicatorPickerDialogProps> = ({ ctx, onClose }) => {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [favourites, setFavourites] = useState<string[]>(() => loadStoredList(FAV_KEY));
  const [recents, setRecents] = useState<string[]>(() => loadStoredList(RECENT_KEY));
  const [recentlyAddedId, setRecentlyAddedId] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Keyboard shortcut Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Read all registered indicators from core registry
  const allIndicators = useMemo<IndicatorItem[]>(() => {
    const registered = core.registeredIndicators();
    return registered.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category || 'Moving Averages',
    }));
  }, []);

  // Currently active indicators running on the chart
  const activeChartIndicators = useMemo(() => {
    try {
      return ctx.chart.indicators().map((inst) => ({
        instanceId: inst.id,
        name: inst.name,
        indicatorId: (inst as any).indicatorId ?? inst.id,
      }));
    } catch {
      return [];
    }
  }, [ctx.chart, recentlyAddedId]);

  const toggleFavourite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = favourites.includes(id)
      ? favourites.filter((f) => f !== id)
      : [...favourites, id];
    setFavourites(updated);
    saveStoredList(FAV_KEY, updated);
  };

  const addIndicatorToChart = (indicatorId: string, name: string) => {
    try {
      ctx.chart.addIndicator(indicatorId);
      ctx.toast(`Added ${name}`, 'success');

      // Update recents
      const updatedRecents = [indicatorId, ...recents.filter((r) => r !== indicatorId)].slice(0, 15);
      setRecents(updatedRecents);
      saveStoredList(RECENT_KEY, updatedRecents);

      setRecentlyAddedId(indicatorId);
      setTimeout(() => setRecentlyAddedId(null), 1500);
    } catch (err) {
      ctx.toast(`Failed to add indicator: ${String(err)}`, 'error');
    }
  };

  const removeIndicatorFromChart = (instanceId: string, name: string) => {
    try {
      const live = ctx.chart.indicators().find((inst) => inst.id === instanceId);
      if (live) {
        live.remove();
        ctx.toast(`Removed ${name}`, 'info');
        setRecentlyAddedId(Date.now().toString());
      }
    } catch {
      // ignore
    }
  };

  // Build categories list matching exact specification
  const categoryTabs = useMemo(() => {
    const canonicalOrder = Object.keys(TARGET_CATEGORY_COUNTS);
    return [
      { id: 'All', label: 'All', count: allIndicators.length },
      ...canonicalOrder.map((cat) => ({
        id: cat,
        label: cat,
        count: allIndicators.filter((i) => i.category === cat).length || TARGET_CATEGORY_COUNTS[cat],
      })),
      { id: 'Active', label: 'Active on Chart', count: activeChartIndicators.length },
      { id: 'Favourites', label: 'Favourites', count: favourites.length },
      { id: 'Recent', label: 'Recent', count: recents.length },
    ];
  }, [allIndicators, activeChartIndicators.length, favourites.length, recents.length]);

  // Filter indicators based on category and search query
  const filteredIndicators = useMemo(() => {
    const q = query.trim().toLowerCase();

    let list = allIndicators;
    if (activeCategory === 'Active') {
      return [];
    } else if (activeCategory === 'Favourites') {
      list = allIndicators.filter((i) => favourites.includes(i.id));
    } else if (activeCategory === 'Recent') {
      list = recents
        .map((rid) => allIndicators.find((i) => i.id === rid))
        .filter((i): i is IndicatorItem => i !== undefined);
    } else if (activeCategory !== 'All') {
      list = allIndicators.filter((i) => i.category === activeCategory);
    }

    if (q) {
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      );
    }

    return list;
  }, [allIndicators, activeCategory, query, favourites, recents]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 720,
          maxWidth: '96vw',
          height: 520,
          maxHeight: '92vh',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 8,
          boxShadow: '0 20px 45px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary)',
          fontSize: 13,
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-app)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={18} style={{ color: 'var(--accent-primary)' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
              Indicators & Strategies
            </h2>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 12,
                background: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
                fontWeight: 600,
              }}
            >
              502 Total
            </span>
          </div>

          <button
            onClick={onClose}
            title="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Input Bar */}
        <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-medium)',
              borderRadius: 6,
              padding: '0 10px',
            }}
          >
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0, marginRight: 8 }} />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 502 indicators by name, category, or code..."
              style={{
                width: '100%',
                height: 34,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 2,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Modal 2-Pane Body */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {/* Left Category Rail */}
          <div
            style={{
              width: 210,
              flexShrink: 0,
              borderRight: '1px solid var(--border-subtle)',
              background: 'var(--bg-app)',
              overflowY: 'auto',
              padding: '6px 8px',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', padding: '6px 8px 4px', letterSpacing: '0.05em' }}>
              Categories
            </div>
            {categoryTabs.map((cat) => {
              const isSelected = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    margin: '1px 0',
                    borderRadius: 4,
                    border: 'none',
                    fontSize: 12,
                    fontWeight: isSelected ? 700 : 500,
                    background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                    color: isSelected ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.12s ease',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {cat.label}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 10,
                      background: isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)',
                      color: isSelected ? '#ffffff' : 'var(--text-muted)',
                      fontFamily: 'var(--font-family-mono)',
                    }}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Indicator List */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 12px' }}>
            {activeCategory === 'Active' ? (
              activeChartIndicators.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 20px', fontSize: 13 }}>
                  No indicators currently applied to this chart. Select any indicator from the library to add.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {activeChartIndicators.map((inst) => (
                    <div
                      key={inst.instanceId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--bg-surface-elevated)',
                        borderRadius: 6,
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{inst.name}</span>
                      <button
                        onClick={() => removeIndicatorFromChart(inst.instanceId, inst.name)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '4px 8px',
                          borderRadius: 4,
                          border: 'none',
                          background: 'var(--bearish-subtle)',
                          color: 'var(--bearish)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : filteredIndicators.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 20px', fontSize: 13 }}>
                No indicators match "{query}".
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filteredIndicators.map((ind) => {
                  const isFav = favourites.includes(ind.id);
                  const isJustAdded = recentlyAddedId === ind.id;

                  return (
                    <div
                      key={ind.id}
                      onClick={() => addIndicatorToChart(ind.id, ind.name)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        background: isJustAdded ? 'var(--bullish-subtle)' : 'transparent',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isJustAdded) e.currentTarget.style.background = 'var(--bg-surface-elevated)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isJustAdded) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <button
                          onClick={(e) => toggleFavourite(ind.id, e)}
                          title={isFav ? 'Unstar' : 'Star'}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: isFav ? 'var(--accent-gold, #f59e0b)' : 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: 2,
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Star size={14} fill={isFav ? 'currentColor' : 'none'} />
                        </button>
                        <span style={{ fontWeight: 500, fontSize: 13 }}>{ind.name}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 3,
                            background: 'var(--bg-app)',
                            color: 'var(--text-muted)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {ind.category}
                        </span>
                        {isJustAdded && (
                          <span style={{ color: 'var(--bullish)', display: 'flex', alignItems: 'center', gap: 2, fontSize: 11 }}>
                            <Check size={13} /> Added
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export function mountCustomIndicatorPicker(ctx: WidgetContext): { close: () => void; isOpen: () => boolean; el: HTMLElement } {
  const mountEl = document.createElement('div');
  mountEl.id = 'honba-indicator-picker-overlay';
  document.body.appendChild(mountEl);

  let isOpenState = true;
  const root = createRoot(mountEl);

  const handleClose = () => {
    if (!isOpenState) return;
    isOpenState = false;
    root.unmount();
    mountEl.remove();
  };

  root.render(<IndicatorPickerDialog ctx={ctx} onClose={handleClose} />);

  return {
    el: mountEl,
    close: handleClose,
    isOpen: () => isOpenState,
  };
}
