import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

import react from '@vitejs/plugin-react';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    open: false,
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // honba serve mounts routes at the root; the browser uses /api[/v1] prefixes
        rewrite: (path) => path.replace(/^\/api(\/v1)?/, ''),
      },
      '/ws': {
        target: 'ws://127.0.0.1:8000',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        portfolio: resolve(__dirname, 'portfolio.html'),
        workbench: resolve(__dirname, 'workbench.html'),
        algodesigner: resolve(__dirname, 'algodesigner.html'),
        simulator: resolve(__dirname, 'simulator.html'),
        researcher: resolve(__dirname, 'researcher.html'),
        instrument: resolve(__dirname, 'instrument.html'),
      },
    },
  },
});
