import * as Sentry from '@sentry/node';
import '@sentry/tracing';
import { Transaction } from '@sentry/types';

import { FastifyInstance } from 'fastify';

// todo: use graasp-sdk?
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
        transaction: Transaction;
      };
    };
  }
}

export const SentryConfig = {
  enable: Boolean(process.env.SENTRY_DSN),
  dsn: process.env.SENTRY_DSN,
  enablePerformance: (process.env.SENTRY_ENABLE_PERFORMANCE ?? 'true') === 'true', // env var must be literal string "true"
  enableProfiling: (process.env.SENTRY_ENABLE_PROFILING ?? 'true') === 'true', // env var must be literal string "true"
  profilesSampleRate: parseFloat(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? '1.0'),
  tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '1.0'),
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
    environment: process.env.DEPLOY_ENV ?? process.env.NODE_ENV,
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
    ignoreErrors: ['missing authorization header'],
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
    instance.decorateRequest('metrics', null);

    instance.addHook('onRequest', async (request, reply) => {
      request.metrics = {
        sentry: {
          transaction: Sentry.startTransaction({
            op: 'request',
            name: `${request.routerMethod ?? request.method} ${request.routerPath ?? request.url}`,
          }),
        },
      };
    });

    instance.addHook('onResponse', async (request, reply) => {
      request.metrics?.sentry?.transaction?.finish();
    });
  }

  instance.addHook('onError', async (request, reply, error) => {
    Sentry.withScope((scope) => {
      scope.setSpan(request.metrics?.sentry?.transaction);
      scope.setTransactionName(request.metrics?.sentry?.transaction?.name);
      if (request.member) {
        scope.setUser({ ...request.member, password: undefined });
      }
      Sentry.captureException(error);
    });
  });

  return { SentryConfig, Sentry };
}
