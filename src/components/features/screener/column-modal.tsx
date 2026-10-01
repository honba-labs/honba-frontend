import React, { useState } from 'react';
import { useScreenerStore } from '../../../core/store/use-screener-store';
import {
  ColumnDef,
  getColumnsForScreenerType,
  getCategoriesForScreenerType,
  getPresetForScreenerTab,
} from '../../../core/columns';
import { X, RotateCcw, Check } from 'lucide-react';

export const ColumnModal: React.FC = () => {
  const isOpen = useScreenerStore((state) => state.isColumnModalOpen);
  const setOpen = useScreenerStore((state) => state.setColumnModalOpen);
  const screenerType = useScreenerStore((state) => state.screenerType || 'stocks');
  const activeTab = useScreenerStore((state) => state.activeTab || 'overview');
  const columns = useScreenerStore((state) => state.columns);
  const setColumns = useScreenerStore((state) => state.setColumns);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [localColumns, setLocalColumns] = useState<ColumnDef[]>([]);

  // Sync with store and screener instrument type when opened
  React.useEffect(() => {
    if (isOpen) {
      setSelectedCategory('all');
      const allowedCols = getColumnsForScreenerType(screenerType);
      const visibleSet = new Set(columns.filter((c) => c.visible).map((c) => c.id));
      
      const merged = allowedCols.map((c) => ({
        ...c,
        visible: visibleSet.has(c.id),
      }));
      setLocalColumns(merged);
    }
  }, [isOpen, screenerType, columns]);

  if (!isOpen) return null;

  const categories = getCategoriesForScreenerType(screenerType);

  const filteredCols =
    selectedCategory === 'all'
      ? localColumns
      : localColumns.filter((c) => c.category === selectedCategory);

  const handleToggle = (id: string) => {
    if (id === 'symbol') return; // Always visible
    setLocalColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, visible: !col.visible } : col))
    );
  };

  const handleResetDefaults = () => {
    const preset = getPresetForScreenerTab(screenerType, activeTab);
    const allowedCols = getColumnsForScreenerType(screenerType);
    setLocalColumns(
      allowedCols.map((c) => ({
        ...c,
        visible: preset.includes(c.id),
      }))
    );
  };

  const handleApply = () => {
    setColumns(localColumns);
    setOpen(false);
  };

  const instrumentTypeName =
    screenerType === 'stocks'
      ? 'Stocks'
      : screenerType === 'etf'
      ? 'ETFs'
      : screenerType === 'bonds'
      ? 'Bonds'
      : 'Mutual Funds';

  return (
    <div className="modal-overlay open" onClick={() => setOpen(false)}>
      <div
        className="modal-dialog"
        style={{ width: 600 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="modal-title">Customize Columns</div>
            <span
              style={{
                fontSize: 11,
                padding: '2px 8px',
                borderRadius: 12,
                backgroundColor: 'var(--accent-subtle, rgba(41, 98, 255, 0.12))',
                color: 'var(--accent-primary, #2962ff)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {instrumentTypeName}
            </span>
          </div>
          <button
            className="nav-icon-btn modal-close-btn"
            style={{ border: 'none' }}
            onClick={() => setOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            padding: '10px 18px 0',
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`view-tab-btn ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label} {cat.id === 'all' ? `(${localColumns.length})` : ''}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ maxHeight: 380, overflowY: 'auto' }}>
          <div
            className="columns-grid"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}
          >
            {filteredCols.map((col) => (
              <label key={col.id} className="checkbox-item" style={{ cursor: col.id === 'symbol' ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={col.visible}
                  disabled={col.id === 'symbol'}
                  onChange={() => handleToggle(col.id)}
                />
                <span style={{ fontSize: 12, fontWeight: 500 }}>{col.label}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 10,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  {col.category}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="nav-icon-btn reset-columns-btn" onClick={handleResetDefaults}>
            <RotateCcw size={12} style={{ marginRight: 4 }} />
            <span>Reset Defaults</span>
          </button>
          <button className="shortlist-btn shortlist-btn-primary apply-columns-btn" onClick={handleApply}>
            <Check size={14} style={{ marginRight: 4 }} />
            <span>Apply Columns</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const HbColumnModal = ColumnModal;
