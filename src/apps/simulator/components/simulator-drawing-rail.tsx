import React from 'react';
import {
  MousePointer,
  TrendingUp,
  Minus,
  ArrowUpRight,
  Square,
  AlignJustify,
  Type,
  Ruler,
  Undo2,
  Redo2,
  Trash2,
  Lock,
} from 'lucide-react';

export type DrawingToolType =
  | 'cursor'
  | 'trendline'
  | 'horizontal_line'
  | 'ray'
  | 'rectangle'
  | 'fibonacci'
  | 'text'
  | 'measure';

export interface SimulatorDrawingRailProps {
  activeTool: DrawingToolType;
  onSelectTool: (tool: DrawingToolType) => void;
  disabled?: boolean;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  drawingCount?: number;
}

interface ToolButtonDef {
  id: DrawingToolType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  hotkey?: string;
}

const TOOLS: ToolButtonDef[] = [
  { id: 'cursor', label: 'Cursor / Crosshair (V)', icon: MousePointer, hotkey: 'V' },
  { id: 'trendline', label: 'Trend Line (T)', icon: TrendingUp, hotkey: 'T' },
  { id: 'horizontal_line', label: 'Horizontal Line (H)', icon: Minus, hotkey: 'H' },
  { id: 'ray', label: 'Ray Line (R)', icon: ArrowUpRight, hotkey: 'R' },
  { id: 'rectangle', label: 'Rectangle / Zone (B)', icon: Square, hotkey: 'B' },
  { id: 'fibonacci', label: 'Fibonacci Retracement (F)', icon: AlignJustify, hotkey: 'F' },
  { id: 'text', label: 'Text Note (N)', icon: Type, hotkey: 'N' },
  { id: 'measure', label: 'Measure Range (M)', icon: Ruler, hotkey: 'M' },
];

export const SimulatorDrawingRail: React.FC<SimulatorDrawingRailProps> = ({
  activeTool,
  onSelectTool,
  disabled = false,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onClear,
  drawingCount = 0,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: 8,
        top: 8,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'var(--bg-surface-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
        padding: 3,
        boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.4))',
        gap: 2,
        userSelect: 'none',
      }}
      title={disabled ? 'Drawing tools disabled during live replay. Pause simulation to draw.' : 'Drawing Tools'}
    >
      {/* Simulation Replay Lock Badge */}
      {disabled && (
        <div
          style={{
            padding: '2px 4px',
            marginBottom: 2,
            borderRadius: 4,
            background: 'var(--accent-subtle, rgba(41,98,255,0.15))',
            color: 'var(--accent-primary)',
            fontSize: 9,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            cursor: 'not-allowed',
          }}
          title="Drawing is paused during live playback. Pause simulation to enable."
        >
          <Lock size={10} />
          <span style={{ fontSize: 8, fontWeight: 700 }}>LOCKED</span>
        </div>
      )}

      {/* Tool Buttons */}
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id && !disabled;

        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => !disabled && onSelectTool(tool.id)}
            disabled={disabled}
            style={{
              width: 26,
              height: 26,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 4,
              background: isActive
                ? 'var(--accent-primary)'
                : 'transparent',
              color: isActive
                ? '#ffffff'
                : disabled
                ? 'var(--text-disabled)'
                : 'var(--text-secondary)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.35 : 1,
              transition: 'all 120ms ease',
            }}
            title={disabled ? 'Pause simulation to use drawing tools' : tool.label}
          >
            <Icon size={14} />
          </button>
        );
      })}

      <div style={{ width: 18, height: 1, background: 'var(--border-subtle)', margin: '2px 0' }} />

      {/* Undo Button */}
      <button
        type="button"
        onClick={() => !disabled && onUndo?.()}
        disabled={disabled || !canUndo}
        style={{
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: 4,
          background: 'transparent',
          color: canUndo && !disabled ? 'var(--text-secondary)' : 'var(--text-disabled)',
          cursor: disabled || !canUndo ? 'not-allowed' : 'pointer',
          opacity: disabled || !canUndo ? 0.35 : 1,
        }}
        title="Undo drawing (Ctrl+Z)"
      >
        <Undo2 size={13} />
      </button>

      {/* Redo Button */}
      <button
        type="button"
        onClick={() => !disabled && onRedo?.()}
        disabled={disabled || !canRedo}
        style={{
          width: 26,
          height: 26,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: 4,
          background: 'transparent',
          color: canRedo && !disabled ? 'var(--text-secondary)' : 'var(--text-disabled)',
          cursor: disabled || !canRedo ? 'not-allowed' : 'pointer',
          opacity: disabled || !canRedo ? 0.35 : 1,
        }}
        title="Redo drawing (Ctrl+Y)"
      >
        <Redo2 size={13} />
      </button>

      {/* Clear All Drawings */}
      {drawingCount > 0 && (
        <button
          type="button"
          onClick={() => !disabled && onClear?.()}
          disabled={disabled}
          style={{
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderRadius: 4,
            background: 'transparent',
            color: disabled ? 'var(--text-disabled)' : 'var(--bearish, #f23645)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.35 : 1,
          }}
          title={`Clear ${drawingCount} drawing${drawingCount > 1 ? 's' : ''}`}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
};
