import React, { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';

import './monaco-setup';
import { HONBA_THEME } from './monaco-setup';
import type { EditorMarker, MarkerSeverity } from '../../core/designer/diagnostics';

export interface EditorReveal {
  /** 1-based line to scroll to and place the cursor on. */
  line: number;
  /** Bumped by the caller so repeated reveals of the same line still fire. */
  nonce: number;
}

export interface MonacoPythonEditorProps {
  value: string;
  onChange: (value: string) => void;
  markers?: EditorMarker[];
  onCursorChange?: (position: { line: number; column: number }) => void;
  /** Canvas -> editor navigation: scroll to and select a node's declaration. */
  reveal?: EditorReveal | null;
  /** Editor -> canvas navigation: a click on a line, for node selection. */
  onLineClick?: (line: number) => void;
}

type MonacoEditor = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];

function toSeverity(monaco: Monaco, severity: MarkerSeverity): number {
  switch (severity) {
    case 'warning':
      return monaco.MarkerSeverity.Warning;
    case 'info':
      return monaco.MarkerSeverity.Info;
    default:
      return monaco.MarkerSeverity.Error;
  }
}

/**
 * Monaco Python editor (Phase 2). Loaded lazily by `code-editor-pane.tsx`.
 * Renders read-only diagnostics from the verifier/recogniser as gutter + squiggle
 * markers, reports cursor position for the status strip, and implements both
 * directions of editor <-> canvas navigation (Phase 3).
 */
const MonacoPythonEditor: React.FC<MonacoPythonEditorProps> = ({
  value,
  onChange,
  markers,
  onCursorChange,
  reveal,
  onLineClick,
}) => {
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const lineClickRef = useRef(onLineClick);
  lineClickRef.current = onLineClick;

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onDidChangeCursorPosition((event) => {
      onCursorChange?.({ line: event.position.lineNumber, column: event.position.column });
    });
    editor.onMouseDown((event) => {
      const line = event.target.position?.lineNumber;
      if (line) lineClickRef.current?.(line);
    });
  };

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    const model = editor.getModel();
    if (!model) return;
    monaco.editor.setModelMarkers(
      model,
      'honba',
      (markers ?? []).map((marker) => ({
        startLineNumber: marker.line,
        endLineNumber: marker.line,
        startColumn: 1,
        endColumn: model.getLineLength(marker.line) + 1 || 1,
        message: marker.message,
        severity: toSeverity(monaco, marker.severity),
        ...(marker.code ? { code: marker.code } : {}),
      })),
    );
  }, [markers, value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !reveal) return;
    editor.revealLineInCenter(reveal.line);
    editor.setPosition({ lineNumber: reveal.line, column: 1 });
  }, [reveal]);

  return (
    <Editor
      height="100%"
      width="100%"
      language="python"
      theme={HONBA_THEME}
      value={value}
      onChange={(next) => onChange(next ?? '')}
      onMount={handleMount}
      loading={<div style={{ padding: 16, fontSize: 12, color: 'var(--text-secondary)' }}>Loading Python editor…</div>}
      options={{
        fontSize: 12,
        fontFamily: 'var(--font-family-mono)',
        minimap: { enabled: false },
        lineNumbers: 'on',
        glyphMargin: true,
        scrollBeyondLastLine: false,
        automaticLayout: true,
        tabSize: 4,
        renderWhitespace: 'selection',
        quickSuggestions: true,
        suggestOnTriggerCharacters: true,
        smoothScrolling: true,
        padding: { top: 8 },
      }}
    />
  );
};

export default MonacoPythonEditor;
