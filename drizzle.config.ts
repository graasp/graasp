import 'dotenv/config';
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  out: './src/drizzle',
  schema: './src/drizzle/schema.ts',
  dbCredentials: {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT!),
    user: process.env.DB_USERNAME!,
    password: process.env.DB_PASSWORD!,
    database: process.env.DB_NAME!,
    ssl:
      process.env.NODE_ENV === 'production' &&
      // disable SSL in local, only set the var for it to disable the use of SSL
      !process.env.DB_DISABLE_SSL,
  },
  // Print all statements
  verbose: true,
  // Always ask for confirmation
  strict: true,
});
