import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    // Generous budgets so suite-wide runs don't flake on CPU contention;
    // these guard against hangs, not slowness.
    testTimeout: 60000,
    hookTimeout: 60000,
    retry: 0,
    setupFiles: ['./src/__tests__/setup.tsx'],
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', '.next', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      // Count every source file, not only the ones a test happens to import,
      // so the percentages are honest.
      include: ['src/**/*.{ts,tsx}'],
      // Ratchet: set a few points below the measured baseline (2026-11-25:
      // statements 42.3, branches 38.5, functions 42.7, lines 43.8) so coverage
      // cannot regress. Raise these as coverage grows; the long-term goal in
      // validation.config.json is 70 minimum / 80 target.
      thresholds: {
        statements: 40,
        branches: 36,
        functions: 40,
        lines: 41,
      },
      exclude: [
        'node_modules/',
        '.next/',
        'src/__tests__/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
  resolve: {
    alias: {
      '@/db': path.resolve(__dirname, './db'),
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './src/__tests__/server-only.ts'),
    },
  },
});
