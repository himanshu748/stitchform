import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Both pages build to static files. The form editor still runs entirely in the browser.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    rolldownOptions: {
      input: {
        landing: resolve(import.meta.dirname, 'index.html'),
        app: resolve(import.meta.dirname, 'app/index.html'),
      },
    },
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
