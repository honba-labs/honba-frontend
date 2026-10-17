import React, { useState } from 'react';
import { BookmarkPlus, Copy, FileCode, Layers, Tag, User, X } from 'lucide-react';
import {
  STRATEGY_CATEGORIES,
  type SavedStrategyManifest,
  type StrategyCategory,
} from '../../core/designer/library-store';

export interface SaveToLibraryModalProps {
  initialName: string;
  initialCategory?: StrategyCategory;
  initialDescription?: string;
  initialTags?: string[];
  initialAuthor?: string;
  initialVersion?: string;
  onSave: (details: {
    name: string;
    category: StrategyCategory;
    description: string;
    tags: string[];
    author: string;
    version: string;
    asCopy: boolean;
  }) => Promise<void>;
  onClose: () => void;
}

export const SaveToLibraryModal: React.FC<SaveToLibraryModalProps> = ({
  initialName,
  initialCategory = 'custom',
  initialDescription = '',
  initialTags = [],
  initialAuthor = 'Quant',
  initialVersion = '1.0.0',
  onSave,
  onClose,
}) => {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<StrategyCategory>(initialCategory);
  const [description, setDescription] = useState(initialDescription);
  const [tags, setTags] = useState(initialTags.join(', '));
  const [author, setAuthor] = useState(initialAuthor);
  const [version, setVersion] = useState(initialVersion);
  const [saving, setSaving] = useState(false);

  const cleanName = (val: string) => val.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');

  const handleSave = async (asCopy: boolean) => {
    const finalName = cleanName(name) || 'untitled_strategy';
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      await onSave({
        name: asCopy ? `${finalName}_copy` : finalName,
        category,
        description: description.trim(),
        tags: tagList,
        author: author.trim() || 'Quant',
        version: version.trim() || '1.0.0',
        asCopy,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Save Strategy to Library"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--bg-surface, #1e222d)',
          border: '1px solid var(--border-medium, #363a45)',
          borderRadius: 'var(--radius-lg, 8px)',
          boxShadow: 'var(--shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.6))',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: 20,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookmarkPlus size={18} style={{ color: 'var(--theme-blue, #2962ff)' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Save Strategy to Library</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Persist algorithm manifest, code, and defaults</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Strategy Name & Python file */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              <FileCode size={13} /> Strategy File Name (.py)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-surface-elevated, #2a2e39)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm, 4px)', padding: '0 8px' }}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="strategy_name"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontFamily: 'var(--font-family-mono)',
                  padding: '7px 0',
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-family-mono)' }}>.py</span>
            </div>
          </div>

          {/* Category & Version */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 10 }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <Layers size={13} /> Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as StrategyCategory)}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface-elevated, #2a2e39)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm, 4px)',
                  padding: '7px 8px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none',
                }}
              >
                {STRATEGY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace('/', ' / ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
                Version
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                style={{
                  width: '100%',
                  background: 'var(--bg-surface-elevated, #2a2e39)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm, 4px)',
                  padding: '7px 8px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  fontFamily: 'var(--font-family-mono)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>
              Description & Alpha Thesis
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Dual moving average cross with ATR trailing stop for equities intraday"
              rows={2}
              style={{
                width: '100%',
                background: 'var(--bg-surface-elevated, #2a2e39)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm, 4px)',
                padding: '7px 8px',
                color: 'var(--text-primary)',
                fontSize: 12,
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          {/* Tags & Author */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <Tag size={12} /> Tags (comma-separated)
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="trend, 15m, nifty"
                style={{
                  width: '100%',
                  background: 'var(--bg-surface-elevated, #2a2e39)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm, 4px)',
                  padding: '7px 8px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <User size={12} /> Author
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Quant"
                style={{
                  width: '100%',
                  background: 'var(--bg-surface-elevated, #2a2e39)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm, 4px)',
                  padding: '7px 8px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 14 }}>
          <button
            type="button"
            className="shortlist-btn"
            onClick={onClose}
            style={{ padding: '6px 12px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="shortlist-btn shortlist-btn-secondary"
            disabled={saving}
            onClick={() => void handleSave(true)}
            title="Save as a new separate copy in the library"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px' }}
          >
            <Copy size={13} />
            <span>Save as New Copy</span>
          </button>
          <button
            type="button"
            className="shortlist-btn shortlist-btn-primary"
            disabled={saving}
            onClick={() => void handleSave(false)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px' }}
          >
            <BookmarkPlus size={13} />
            <span>{saving ? 'Saving…' : 'Save to Library'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
