import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Check, Globe, Layers, TrendingUp, DollarSign, Zap, Sparkles } from 'lucide-react';
import { useScreenerStore } from '../../../core/store/use-screener-store';
import { ScreenDefinition, BUILTIN_SCREENS } from '../../../core/screen-definitions';
import { SCREENER_CONFIG } from '../../../core/filter-config';

export const OpenScreenModal: React.FC = () => {
  const isOpen = useScreenerStore((state) => state.isOpenScreenModalOpen);
  const setOpen = useScreenerStore((state) => state.setOpenScreenModalOpen);
  const screenerType = useScreenerStore((state) => state.screenerType);
  const activeScreenId = useScreenerStore((state) => state.activeScreenId);
  const selectScreen = useScreenerStore((state) => state.selectScreen);
  const customScreens = useScreenerStore((state) => state.customScreens);

  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setActiveCategory('all');
      setTimeout(() => searchInputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Combine built-in screens for this asset type + user custom screens
  const assetScreens = useMemo(() => {
    const builtin = BUILTIN_SCREENS.filter((s) => s.screenerType === screenerType);
    const user = customScreens.filter((s) => s.screenerType === screenerType);
    return [...user, ...builtin];
  }, [screenerType, customScreens]);

  const filteredScreens = useMemo(() => {
    return assetScreens.filter((s) => {
      if (activeCategory !== 'all') {
        if (activeCategory === 'custom' && s.isBuiltin) return false;
        if (activeCategory !== 'custom' && s.category !== activeCategory) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        return (
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [assetScreens, activeCategory, search]);

  if (!isOpen) return null;

  const currentConfig = SCREENER_CONFIG[screenerType];

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'popular':
        return <Zap size={14} style={{ color: '#f59e0b' }} />;
      case 'fundamental':
        return <Layers size={14} style={{ color: '#3b82f6' }} />;
      case 'technical':
        return <TrendingUp size={14} style={{ color: '#10b981' }} />;
      case 'valuation':
        return <DollarSign size={14} style={{ color: '#8b5cf6' }} />;
      case 'custom':
        return <Sparkles size={14} style={{ color: '#ec4899' }} />;
      default:
        return <Globe size={14} />;
    }
  };

  return (
    <div className="tv-modal-backdrop" onClick={() => setOpen(false)}>
      <div
        className="tv-modal-dialog"
        style={{
          width: 580,
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 8,
          background: 'var(--surface-primary, #1e222d)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
          border: '1px solid var(--border-color, #2a2e39)',
          overflow: 'hidden',
          animation: 'fadeSlideUp 0.15s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px 12px',
            borderBottom: '1px solid var(--border-color, #2a2e39)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary, #d1d4dc)' }}>
              Open screen
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 4,
                background: 'rgba(41, 98, 255, 0.15)',
                color: 'var(--accent-primary, #2962ff)',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {currentConfig.defaultTitle}
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #787b86)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Close menu (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Input */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-color, #2a2e39)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--surface-input, #131722)',
              borderRadius: 6,
              padding: '8px 12px',
              border: '1px solid var(--border-input, #363a45)',
            }}
          >
            <Search size={15} style={{ color: 'var(--text-muted, #787b86)' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={`Search ${currentConfig.defaultTitle} screens...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-primary, #d1d4dc)',
                fontSize: 13,
                outline: 'none',
                width: '100%',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted, #787b86)',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Categories Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 20px',
            borderBottom: '1px solid var(--border-color, #2a2e39)',
            overflowX: 'auto',
            background: 'var(--surface-secondary, #171b26)',
          }}
        >
          {[
            { id: 'all', label: 'All Screens' },
            { id: 'popular', label: 'Popular' },
            { id: 'fundamental', label: 'Fundamentals' },
            { id: 'technical', label: 'Technicals' },
            { id: 'valuation', label: 'Valuation' },
            { id: 'custom', label: 'My Saved' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '4px 10px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: activeCategory === cat.id ? 600 : 400,
                color: activeCategory === cat.id ? '#ffffff' : 'var(--text-muted, #787b86)',
                background: activeCategory === cat.id ? 'var(--accent-primary, #2962ff)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Screen List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 12px',
            maxHeight: '420px',
          }}
        >
          {filteredScreens.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--text-muted, #787b86)', fontSize: 13 }}>
              No screens found matching "{search}"
            </div>
          ) : (
            filteredScreens.map((screen) => {
              const isSelected = screen.id === activeScreenId;
              return (
                <div
                  key={screen.id}
                  onClick={() => selectScreen(screen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(41, 98, 255, 0.12)' : 'transparent',
                    border: isSelected ? '1px solid rgba(41, 98, 255, 0.3)' : '1px solid transparent',
                    marginBottom: 4,
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--surface-hover, #2a2e39)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ marginTop: 2 }}>{getCategoryIcon(screen.category)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? 'var(--accent-primary, #2962ff)' : 'var(--text-primary, #d1d4dc)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {screen.name}
                        </span>
                        {!screen.isBuiltin && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '1px 5px',
                              borderRadius: 3,
                              background: '#ec4899',
                              color: '#fff',
                              fontWeight: 600,
                            }}
                          >
                            Custom
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--text-muted, #787b86)',
                          marginTop: 2,
                          lineHeight: 1.3,
                        }}
                      >
                        {screen.description}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div style={{ marginLeft: 12, color: 'var(--accent-primary, #2962ff)' }}>
                      <Check size={16} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer info & hotkey hints */}
        <div
          style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--border-color, #2a2e39)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 11,
            color: 'var(--text-muted, #787b86)',
            background: 'var(--surface-secondary, #171b26)',
          }}
        >
          <span>Showing {filteredScreens.length} screens for {currentConfig.defaultTitle}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span>Shortcut: <kbd style={{ background: '#2a2e39', padding: '2px 5px', borderRadius: 3, color: '#d1d4dc' }}>.</kbd> to open</span>
            <span><kbd style={{ background: '#2a2e39', padding: '2px 5px', borderRadius: 3, color: '#d1d4dc' }}>Esc</kbd> to close</span>
          </div>
        </div>
      </div>
    </div>
  );
};
