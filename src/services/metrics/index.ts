import { FastifyPluginAsync } from 'fastify';

import { SentryConfig } from './providers/sentry';
import { MetricsService } from './service';

export interface MetricsPluginOptions {
  // sentry-specific options
  sentry: SentryConfig;
}

const metricsPlugin: FastifyPluginAsync<MetricsPluginOptions> = async (fastify, options) => {
  const metrics = new MetricsService(options);

  fastify.decorate('metrics', metrics);

  // add metrics on requests through hooks
  // https://www.fastify.io/docs/latest/Reference/Decorators/
  fastify.decorateRequest('metrics', {
    lifecycle: {},
  });

  fastify.addHook('onRequest', async (request, reply) => {
    request.metrics.lifecycle = metrics.start({
      name: 'request',
      description: `${request.routerMethod ?? request.method} ${request.routerPath ?? request.url}`,
    });
  });

  fastify.addHook('onResponse', async (request, reply) => {
    request.metrics.lifecycle.stop();
  });

  fastify.addHook('onError', async (request, reply, error) => {
    request.metrics.lifecycle.capture(error);
  });
};

export default metricsPlugin;
