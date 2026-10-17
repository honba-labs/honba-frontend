/**
 * Local Monaco configuration (Phase 2, HBD-2026-DES-004).
 *
 * Imported ONLY from the lazily-loaded `monaco-python-editor` module so the
 * ~1 MB editor bundle is a separate chunk and never lands in the Designer's
 * initial payload. Monaco is wired to the bundled package (not the jsDelivr CDN
 * the loader would otherwise fetch), so the workspace works offline.
 */
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import { loader } from '@monaco-editor/react';

// Python is delivered via basic-languages (no language service), so the base
// editor worker is all that is required.
(globalThis as { MonacoEnvironment?: { getWorker: () => Worker } }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

loader.config({ monaco });

export const HONBA_THEME = 'honba-dark';

monaco.editor.defineTheme(HONBA_THEME, {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
    { token: 'keyword', foreground: '7aa2f7' },
    { token: 'string', foreground: '9ece6a' },
    { token: 'number', foreground: 'ff9e64' },
    { token: 'type', foreground: '2ac3de' },
  ],
  colors: {
    'editor.background': '#131722',
    'editor.foreground': '#d1d4dc',
    'editorLineNumber.foreground': '#4c525e',
    'editorLineNumber.activeForeground': '#d1d4dc',
    'editor.lineHighlightBackground': '#1e222d',
    'editor.selectionBackground': '#2a2e39',
    'editorGutter.background': '#131722',
  },
});

const SDK_KEYWORDS = [
  'from honba.strategies.base import Parameter, Strategy',
  'from honba.strategies.indicators import build_indicator',
  'class StrategyName(Strategy):',
  '    def on_start(self) -> None:',
  '    def on_bar(self, bar) -> None:',
  '    def on_order_filled(self, order) -> None:',
  'self.buy(',
  'self.sell(',
  'self.indicators.',
  'build_indicator(',
  'Parameter(',
  'bar.close',
  'bar.open',
  'bar.high',
  'bar.low',
  'bar.volume',
  'bar.instrument_id',
];

function completionItems(range: monaco.IRange): monaco.languages.CompletionItem[] {
  return SDK_KEYWORDS.map((label, index) => ({
    label,
    kind: index < 4 ? monaco.languages.CompletionItemKind.Snippet : monaco.languages.CompletionItemKind.Method,
    insertText: label,
    detail: 'Honba Strategy SDK',
    range,
  }));
}

monaco.languages.registerCompletionItemProvider('python', {
  provideCompletionItems: (model, position) => {
    const word = model.getWordUntilPosition(position);
    const range: monaco.IRange = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    };
    return { suggestions: completionItems(range) };
  },
});

export { monaco };
