import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Ensure to call this before importing any other modules!
Sentry.init({
  dsn: 'https://ded7c79d01134707b9a5d86df211a68f@o244065.ingest.us.sentry.io/6177699', // process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENV,
  release: process.env.APP_VERSION ?? 'not-specified',
  // Adds request headers and IP for users, for more info visit:
  // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  integrations: [
    Sentry.fastifyIntegration(),
    // Add our Profiling integration
    nodeProfilingIntegration(),
  ],

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for tracing.
  // We recommend adjusting this value in production
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#tracesSampleRate
  tracesSampleRate: 1.0,

  // Set profilesSampleRate to 1.0 to profile 100%
  // of sampled transactions.
  // This is relative to tracesSampleRate
  // Learn more at
  // https://docs.sentry.io/platforms/javascript/guides/node/configuration/options/#profilesSampleRate
  profilesSampleRate: 1.0,

  // Enable if you need to troubleshoot the Sentry config
  // debug: true,

  enableLogs: true,
  beforeSendLog: (log) => {
    return log;
  },
});
