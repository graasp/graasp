import { URL, fileURLToPath } from 'url';
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.vitest.ts'],
    coverage: {
      reporter: ['lcov', 'text'],
    },
  },
  resolve: {
    alias: [{ find: '@/', replacement: fileURLToPath(new URL('./', import.meta.url)) }],
  },
});
