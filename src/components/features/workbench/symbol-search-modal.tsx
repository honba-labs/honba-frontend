import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, TrendingUp, Sparkles, Hash } from 'lucide-react';
import {
  searchInstruments,
  getAvailableSymbolPoolSize,
  type SymbolCategory,
  type SearchResultItem,
  isArithmeticExpression,
} from '../../../core/symbol-search';

interface SymbolSearchModalProps {
  open: boolean;
  onClose: () => void;
  currentSymbol: string;
  onSelectSymbol: (symbol: string, exchange?: string) => void;
  initialQuery?: string;
}

const CATEGORIES: SymbolCategory[] = ['ALL', 'Index', 'Cash', 'F&O', 'Commodity', 'Crypto'];

const PAGE_BATCH_SIZE = 120;

/**
 * High-fidelity OpenAlgo-parity Symbol Search Modal
 * Supports:
 * - Full available symbol pool (~3,750+ real instruments across NSE Bhavcopy, DuckDB, Indices, US/JP/UK, F&O, Commodities, Crypto, MF, ETFs, Bonds)
 * - Category filter chips (ALL, Index, Cash, F&O, Commodity, Crypto) with live segment counts
 * - Dynamic on-the-fly chart entry for ANY arbitrary user-typed symbol outside database
 * - Incremental scroll rendering through the entire matching symbol pool
 * - Full keyboard navigation (Arrows, Enter, Escape)
 */
export const SymbolSearchModal: React.FC<SymbolSearchModalProps> = ({
  open,
  onClose,
  currentSymbol,
  onSelectSymbol,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [activeCategory, setActiveCategory] = useState<SymbolCategory>('ALL');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_BATCH_SIZE);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset query and focus input on open
  useEffect(() => {
    if (!open) return undefined;
    setQuery(initialQuery || '');
    setActiveCategory('ALL');
    setSelectedIndex(0);
    setVisibleLimit(PAGE_BATCH_SIZE);
    const timer = setTimeout(() => {
      const input = inputRef.current;
      if (input) {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }, 30);
    return () => clearTimeout(timer);
  }, [open, initialQuery]);

  // Compute full search results across the entire available symbol pool
  const allResults = useMemo(() => {
    if (!open) return [];
    return searchInstruments(query, activeCategory, 5000);
  }, [open, query, activeCategory]);

  const totalPoolSize = useMemo(() => {
    if (!open) return 0;
    return getAvailableSymbolPoolSize('ALL');
  }, [open]);

  const categoryCounts = useMemo(() => {
    if (!open) return {} as Record<SymbolCategory, number>;
    return {
      ALL: getAvailableSymbolPoolSize('ALL'),
      Index: getAvailableSymbolPoolSize('Index'),
      Cash: getAvailableSymbolPoolSize('Cash'),
      'F&O': getAvailableSymbolPoolSize('F&O'),
      Commodity: getAvailableSymbolPoolSize('Commodity'),
      Crypto: getAvailableSymbolPoolSize('Crypto'),
    };
  }, [open]);

  // Reset scroll & visible batch when query or category changes
  useEffect(() => {
    setVisibleLimit(PAGE_BATCH_SIZE);
    setSelectedIndex(0);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [query, activeCategory]);

  const visibleResults = useMemo(() => {
    return allResults.slice(0, visibleLimit);
  }, [allResults, visibleLimit]);

  // Keep selection within bounds and expand visible window if keyboard navigation reaches the edge
  useEffect(() => {
    if (selectedIndex >= allResults.length) {
      setSelectedIndex(Math.max(0, allResults.length - 1));
    } else if (selectedIndex >= visibleLimit - 5 && visibleLimit < allResults.length) {
      setVisibleLimit((prev) => Math.min(allResults.length, prev + PAGE_BATCH_SIZE));
    }
  }, [allResults.length, selectedIndex, visibleLimit]);

  // Scroll selected item into view
  useEffect(() => {
    const listEl = listRef.current;
    if (!listEl) return;
    const selectedEl = listEl.querySelector(`[data-idx="${selectedIndex}"]`) as HTMLElement;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) {
      if (visibleLimit < allResults.length) {
        setVisibleLimit((prev) => Math.min(allResults.length, prev + PAGE_BATCH_SIZE));
      }
    }
  };

  const handlePickItem = (item: SearchResultItem) => {
    onSelectSymbol(item.symbol, item.exchange);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((idx) => Math.min(allResults.length - 1, idx + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((idx) => Math.max(0, idx - 1));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setSelectedIndex((idx) => Math.min(allResults.length - 1, idx + 12));
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      setSelectedIndex((idx) => Math.max(0, idx - 12));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const trimmed = query.trim();

      // If user typed an arithmetic expression, chart it directly
      if (isArithmeticExpression(trimmed)) {
        onSelectSymbol(trimmed, 'EXPR');
        onClose();
        return;
      }

      // If results exist and something is selected
      if (allResults[selectedIndex]) {
        handlePickItem(allResults[selectedIndex]);
      } else if (trimmed) {
        // Fallback for typing any arbitrary symbol
        onSelectSymbol(trimmed.toUpperCase(), 'NSE');
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(3px)',
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '82vh',
          background: 'var(--bg-surface-elevated, #1e222d)',
          border: '1px solid var(--border-medium, #2a2e39)',
          borderRadius: 8,
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary, #d1d4dc)',
          fontSize: 13,
          animation: 'fadeIn 0.12s ease-out',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header Title Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px 8px 16px',
            borderBottom: '1px solid var(--border-subtle, #2a2e39)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14 }}>
            <Search size={15} style={{ color: 'var(--accent-primary, #2962ff)' }} />
            <span>Symbol Search</span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 10,
                background: 'var(--bg-surface, #2a2e39)',
                color: 'var(--text-muted, #787b86)',
              }}
            >
              {totalPoolSize.toLocaleString('en-IN')} available symbols
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted, #787b86)',
              cursor: 'pointer',
              display: 'flex',
              padding: 4,
              borderRadius: 4,
            }}
            title="Close (Esc)"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            background: 'var(--bg-app, #131722)',
            borderBottom: '1px solid var(--border-subtle, #2a2e39)',
          }}
        >
          <Search size={16} style={{ color: 'var(--text-muted, #787b86)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search symbol, ticker, company, ETF, bond, or F&O contract..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-primary, #d1d4dc)',
              fontSize: 14,
              fontWeight: 500,
            }}
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #787b86)',
                cursor: 'pointer',
                padding: 2,
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Segment Category Chips */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderBottom: '1px solid var(--border-subtle, #2a2e39)',
            background: 'var(--bg-surface-elevated, #1e222d)',
            overflowX: 'auto',
          }}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            const count = categoryCounts[cat];
            return (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  setSelectedIndex(0);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 10px',
                  borderRadius: 12,
                  border: 'none',
                  background: isActive ? 'var(--accent-primary, #2962ff)' : 'var(--bg-surface, #2a2e39)',
                  color: isActive ? '#ffffff' : 'var(--text-secondary, #b2b5be)',
                  fontSize: 11.5,
                  fontWeight: isActive ? 700 : 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background 0.1s ease',
                }}
              >
                <span>{cat}</span>
                {typeof count === 'number' && (
                  <span
                    style={{
                      fontSize: 9.5,
                      opacity: isActive ? 0.9 : 0.65,
                      fontWeight: 600,
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Results Column Headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '130px 1fr 140px',
            padding: '6px 16px',
            borderBottom: '1px solid var(--border-subtle, #2a2e39)',
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted, #787b86)',
            background: 'var(--bg-app, #131722)',
          }}
        >
          <span>Symbol</span>
          <span>Description</span>
          <span style={{ textAlign: 'right' }}>Type & Price</span>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          onScroll={handleListScroll}
          style={{
            flex: 1,
            overflowY: 'auto',
            maxHeight: 380,
            padding: '4px 0',
          }}
        >
          {visibleResults.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted, #787b86)' }}>
              <p style={{ margin: '0 0 6px 0', fontSize: 13 }}>No results found for &ldquo;{query}&rdquo;</p>
              <button
                onClick={() => {
                  if (query.trim()) {
                    onSelectSymbol(query.trim().toUpperCase(), 'NSE');
                    onClose();
                  }
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 4,
                  border: '1px solid var(--accent-primary, #2962ff)',
                  background: 'var(--accent-subtle, rgba(41, 98, 255, 0.15))',
                  color: 'var(--accent-primary, #2962ff)',
                  fontWeight: 600,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Chart &ldquo;{query.trim().toUpperCase()}&rdquo; anyway
              </button>
            </div>
          ) : (
            visibleResults.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isCurrent = item.symbol.toUpperCase() === currentSymbol.toUpperCase();

              return (
                <div
                  key={`${item.symbol}_${item.exchange}_${idx}`}
                  data-idx={idx}
                  onClick={() => handlePickItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '130px 1fr 140px',
                    alignItems: 'center',
                    padding: '8px 16px',
                    cursor: 'pointer',
                    background: isSelected
                      ? 'var(--accent-subtle, rgba(41, 98, 255, 0.16))'
                      : isCurrent
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent-primary, #2962ff)' : '3px solid transparent',
                    transition: 'background 0.05s ease',
                  }}
                >
                  {/* Symbol Column */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    {item.isCustom ? (
                      <Sparkles size={13} style={{ color: '#f59e0b', flexShrink: 0 }} />
                    ) : item.isExpression ? (
                      <Hash size={13} style={{ color: 'var(--accent-primary, #2962ff)', flexShrink: 0 }} />
                    ) : (
                      <TrendingUp size={13} style={{ opacity: 0.5, flexShrink: 0 }} />
                    )}
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: 12.5,
                        color: isSelected ? 'var(--accent-primary, #2962ff)' : 'var(--text-primary, #d1d4dc)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.symbol}
                    </span>
                  </div>

                  {/* Description Column */}
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-secondary, #b2b5be)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      paddingRight: 12,
                    }}
                  >
                    {item.name}
                  </div>

                  {/* Type, Exchange & Price Column */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '1px 4px',
                        borderRadius: 3,
                        background:
                          item.type === 'INDEX'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : item.type === 'FUT' || item.type === 'CE' || item.type === 'PE'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : item.type === 'CUSTOM'
                            ? 'rgba(245, 158, 11, 0.18)'
                            : 'rgba(255, 255, 255, 0.08)',
                        color:
                          item.type === 'INDEX'
                            ? '#10b981'
                            : item.type === 'FUT' || item.type === 'CE' || item.type === 'PE'
                            ? '#f43f5e'
                            : item.type === 'CUSTOM'
                            ? '#f59e0b'
                            : 'var(--text-muted, #787b86)',
                      }}
                    >
                      {item.type}
                    </span>

                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: 'var(--text-muted, #787b86)',
                      }}
                    >
                      {item.exchange}
                    </span>

                    {item.price > 0 && (
                      <span
                        style={{
                          fontSize: 11.5,
                          fontFamily: 'var(--font-family-mono, monospace)',
                          fontWeight: 600,
                          color: 'var(--text-primary, #d1d4dc)',
                          minWidth: 50,
                          textAlign: 'right',
                        }}
                      >
                        ₹{item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Hint Bar */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-subtle, #2a2e39)',
            fontSize: 11,
            color: 'var(--text-muted, #787b86)',
            background: 'var(--bg-app, #131722)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            Press <kbd style={{ padding: '1px 4px', background: 'var(--bg-surface, #2a2e39)', borderRadius: 3, border: '1px solid var(--border-medium, #363a45)', fontSize: 10 }}>Enter</kbd> to load selected symbol. Scroll to browse all matches.
          </span>
          <span style={{ fontSize: 10 }}>
            {visibleResults.length < allResults.length
              ? `Showing ${visibleResults.length.toLocaleString('en-IN')} of ${allResults.length.toLocaleString('en-IN')} matches`
              : `${allResults.length.toLocaleString('en-IN')} matches`}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
};
