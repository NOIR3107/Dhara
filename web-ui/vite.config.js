import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// React "islands" for the plain-HTML DHARA site. web/home.html and
// web/report.html stay hand-written and load these bundles, so file names are
// stable (no hashes) and the pages bump a ?v= query to bust caches.
export default defineConfig({
  plugins: [react()],
  base: '/ui/',
  build: {
    outDir: '../web/ui',
    emptyOutDir: true,
    cssCodeSplit: false,
    target: 'es2019',
    rollupOptions: {
      input: {
        home: 'src/home.jsx',
        report: 'src/report.jsx'
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    }
  }
});
