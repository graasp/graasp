import { URL, fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.vitest.ts'],
    coverage: {
      reporter: ['lcov', 'text'],
    },
    outputFile: 'coverage/sonar-report.xml',
  },
  resolve: {
    alias: [{ find: '@/', replacement: fileURLToPath(new URL('./', import.meta.url)) }],
  },
});
