import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

/**
 * Vite configuration.
 *
 * Notes:
 * - `server.host = 0.0.0.0` + `allowedHosts: true` so the dev server is reachable
 *   through reverse proxies / sandbox preview hosts.
 * - Rapier ships its WASM payload inlined, so no special asset handling is needed.
 */
export default defineConfig({
  // Relative base so the production build works both at a domain root and under
  // a sub-path such as GitHub Pages' /<repo>/ — assets resolve relative to the
  // page instead of assuming the site sits at "/".
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    // The sandbox preview proxies https -> this port; let Vite know it is fine to
    // serve those origins instead of answering "Blocked request".
    hmr: {
      protocol: 'ws',
      host: undefined,
      clientPort: undefined,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          physics: ['@dimforge/rapier3d-compat'],
        },
      },
    },
  },
});
