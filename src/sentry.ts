import * as Sentry from '@sentry/node';
import '@sentry/tracing';

import type { FastifyInstance } from 'fastify';

import {
  APP_VERSION,
  NODE_ENV,
  SENTRY_DSN,
  SENTRY_ENABLE_PERFORMANCE,
  SENTRY_ENABLE_PROFILING,
  SENTRY_ENV,
  SENTRY_PROFILES_SAMPLE_RATE,
  SENTRY_TRACES_SAMPLE_RATE,
} from './utils/config';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Collects metrics for logs, monitoring, traces
     */
    metrics?: {
      /**
       * Metrics collected by Sentry
       */
      sentry?: {
        /**
         * Sentry transaction span attached to the request
         */
        transaction: Sentry.Transaction;
      };
    };
  }
}

const IGNORED_TRANSACTIONS = {
  // retry from websocket generates failed requests when builder is not authenticated (public item)
  'GET /ws': 'missing authorization header',
};

export const SentryConfig = {
  enable: Boolean(SENTRY_DSN),
  dsn: SENTRY_DSN,
  enablePerformance: SENTRY_ENABLE_PERFORMANCE,
  enableProfiling: SENTRY_ENABLE_PROFILING,
  profilesSampleRate: SENTRY_PROFILES_SAMPLE_RATE,
  tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
};

export function initSentry(instance: FastifyInstance): {
  SentryConfig: typeof SentryConfig;
  Sentry?: typeof Sentry;
} {
  if (!SentryConfig.enable) {
    return { SentryConfig };
  }

  Sentry.init({
    dsn: SentryConfig.dsn,
    environment: SENTRY_ENV ?? NODE_ENV,
    release: APP_VERSION,
    integrations: [
      // TODO: re-enable when @sentry/profiling-node is more stable
      // (currently does not report profiles and also causes compilation issues)
      // ...(SentryConfig.enableProfiling ? [new ProfilingIntegration()] : []),
    ],
    profilesSampleRate: SentryConfig.profilesSampleRate,
    tracesSampleRate: SentryConfig.tracesSampleRate,
    beforeBreadcrumb: (breadcrumb) => {
      // fix: sentry collects some automatic breadcrumbs
      // however these are currently irrelevant (logs http events such as S3 unrelated to current request lifecycle)
      // TODO: find a better way to exclude unwanted irrelevant auto breadcrumbs (we blanket ban http ones for now)
      if (breadcrumb.category === 'http' && breadcrumb.level === 'info') {
        return null;
      }
      return breadcrumb;
    },
    beforeSend: (event) => {
      // filter events
      const transaction = event.transaction;
      if (
        transaction &&
        transaction in IGNORED_TRANSACTIONS &&
        event.exception?.values?.some(
          ({ value }) =>
            value === IGNORED_TRANSACTIONS[transaction as keyof typeof IGNORED_TRANSACTIONS],
        )
      ) {
        return null;
      }
      // send all other event
      return event;
    },
  });

  if (SentryConfig.enablePerformance) {
    /**
     * This is done for performance reasons:
     * 1. First decorateRequest with the empty type of the value to be set (null for an object)
     *    BUT NEVER SET THE ACTUAL OBJECT IN decorateRequest FOR SECURITY (reference is shared)
     * 2. Then later use a hook such as preHandler or onRequest to store the actual value
     *    (it will be properly encapsulated)
     * @example
     *  fastify.decorateRequest('user', null) // <-- must use null here if user will be an object
     *  // later in the code
     *  fastify.addHook('preHandler', (request) => {
     *     request.user = { name: 'John Doe' } // <-- must set the actual object here
     *  })
     * @see
     *  https://www.fastify.io/docs/latest/Reference/Decorators/#decoraterequestname-value-dependencies
     *  https://www.fastify.io/docs/latest/Reference/Decorators/
     */
    // instance.decorateRequest('metrics', null);

    instance.addHook('onRequest', async (request) => {
      request.metrics = {
        sentry: {
          transaction: Sentry.startTransaction({
            op: 'request',
            name: `${request.routeOptions.method ?? request.method} ${request.routeOptions.url ?? request.url}`,
          }),
        },
      };
    });

    instance.addHook('onResponse', async (request) => {
      request.metrics?.sentry?.transaction?.finish();
    });
  }

  instance.addHook('onError', async (request, reply, error) => {
    Sentry.withScope((scope) => {
      scope.setSpan(request.metrics?.sentry?.transaction);
      scope.setTransactionName(request.metrics?.sentry?.transaction?.name);
      if (request.user?.account) {
        scope.setUser({ ...request.user.account, password: undefined });
      }
      Sentry.captureException(error);
    });
  });

  return { SentryConfig, Sentry };
}
