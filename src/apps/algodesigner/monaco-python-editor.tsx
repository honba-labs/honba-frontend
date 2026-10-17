import React, { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';

import './monaco-setup';
import { HONBA_THEME } from './monaco-setup';
import type { EditorMarker, MarkerSeverity } from '../../core/designer/diagnostics';

export interface MonacoPythonEditorProps {
  value: string;
  onChange: (value: string) => void;
  markers?: EditorMarker[];
  onCursorChange?: (position: { line: number; column: number }) => void;
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
 * markers and reports cursor position for the editor status strip.
 */
const MonacoPythonEditor: React.FC<MonacoPythonEditorProps> = ({ value, onChange, markers, onCursorChange }) => {
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.onDidChangeCursorPosition((event) => {
      onCursorChange?.({ line: event.position.lineNumber, column: event.position.column });
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
