import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Fast configuration: only the module smoke test. */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/smoke.test.ts'],
    reporters: ['dot'],
  },
});
