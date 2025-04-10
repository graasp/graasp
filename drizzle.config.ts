import 'dotenv/config';
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  out: './src/drizzle',
  schema: './src/drizzle/schema.ts',
  dbCredentials: {
    url: process.env.DB_CONNECTION!,
  },
  // Print all statements
  verbose: true,
  // Always ask for confirmation
  strict: true,
});
