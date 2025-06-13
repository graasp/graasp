import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          include: ['**/*.spec.ts'],
          environment: 'node',
          setupFiles: ['./setup.node.ts'],
        },
      },
    ],
  },
});
