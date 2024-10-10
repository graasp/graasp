import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.vitest.ts'],
    coverage: {
      reporter: ['lcov', 'text'],
    },
  },
});
