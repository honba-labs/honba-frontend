import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortState<T = string> {
  key: T | null;
  direction: SortDirection;
}

export interface SortableHeaderProps<T = string> {
  label: string;
  sortKey: T;
  sortState: SortState<T>;
  onSort: (key: T) => void;
  align?: 'left' | 'right' | 'center';
}

export const SortableHeader: React.FC<SortableHeaderProps> = ({ label, sortKey, sortState, onSort, align = 'left' }) => {
  const active = sortState.key === sortKey;
  const dir = active ? sortState.direction : null;
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        padding: '6px 8px',
        textAlign: align,
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
        fontSize: 10,
        textTransform: 'uppercase',
        color: 'var(--text-muted)',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {label}
        {active && dir === 'asc' && <ChevronUp size={10} />}
        {active && dir === 'desc' && <ChevronDown size={10} />}
      </span>
    </th>
  );
};

export function useSort<T = string>(initialKey: T | null = null, initialDir: SortDirection = 'asc') {
  const [sort, setSort] = useState<SortState<T>>({ key: initialKey, direction: initialDir });
  const handleSort = (key: T) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };
  return { sort, handleSort };
}
