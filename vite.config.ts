import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/Bloodwake/' : '/',
  build: {
    sourcemap: true,
    target: 'es2022',
  },
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
}));
