import { defineConfig } from 'vite';

// Static single-page app. No server code: `vite build` writes plain files to dist/.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
});
