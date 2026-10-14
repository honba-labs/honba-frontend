import tsParser from '@typescript-eslint/parser';

// Minimal flat config: parse TypeScript/TSX so `npm run lint` is a real syntax
// gate. Rules are intentionally empty so the pre-existing app code, which was
// never linted, does not turn the check red; tighten rule-by-rule over time.
export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {},
  },
];
