import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import '@sentry/tracing';
import { Integration, Transaction } from '@sentry/types';

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

  const integrations: Array<Integration> = [];
  if (SentryConfig.enableProfiling) {
    integrations.push(new ProfilingIntegration());
  }

  Sentry.init({
    dsn: SentryConfig.dsn,
    environment: process.env.DEPLOY_ENV ?? process.env.NODE_ENV,
    integrations,
    profilesSampleRate: SentryConfig.profilesSampleRate,
    tracesSampleRate: SentryConfig.tracesSampleRate,
  });

  if (SentryConfig.enablePerformance) {
    // fastify Sentry hooks
    // https://www.fastify.io/docs/latest/Reference/Decorators/
    instance.decorateRequest('metrics', {
      sentry: {},
    });
    instance.addHook('onRequest', async (request, reply) => {
      request.metrics.sentry.transaction = Sentry.startTransaction({
        op: 'request',
        name: `${request.routerMethod ?? request.method} ${request.routerPath ?? request.url}`,
      });
    });
    instance.addHook('onResponse', async (request, reply) => {
      request.metrics.sentry.transaction.finish();
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
