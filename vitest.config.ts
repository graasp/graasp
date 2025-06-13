import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // exclude: [
    //   ...configDefaults.exclude,
    //   // .test.ts files are for jest, we use .spec.ts
    //   '**/*.test.ts',
    // ],
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
