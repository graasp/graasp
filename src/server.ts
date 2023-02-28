import fastifyHelmet from '@fastify/helmet';
import fastify from 'fastify';
import fp from 'fastify-plugin';

import registerAppPlugins from './app';
import metricsPlugin from './services/metrics';
// import fastifyCompress from 'fastify-compress';
import {
  CORS_ORIGIN_REGEX,
  DISABLE_LOGS,
  ENVIRONMENT,
  HOSTNAME,
  METRICS_PLUGIN,
  PORT,
  SENTRY_DSN,
  SENTRY_ENABLE_PROFILING,
  SENTRY_PROFILES_SAMPLE_RATE,
  SENTRY_TRACES_SAMPLE_RATE,
} from './util/config';

const start = async () => {
  const instance = fastify({
    logger: !DISABLE_LOGS,
    ajv: {
      customOptions: {
        // This allow routes that take array to correctly interpret single values as an array
        // https://github.com/fastify/fastify/blob/main/docs/Validation-and-Serialization.md
        coerceTypes: 'array',
      },
    },
  });
  /*const instance = fastify({ 
    logger: { 
      prettyPrint: true, 
      level: 'debug' 
    },
    ajv: {
      customOptions: {
        // This allow routes that take array to correctly interpret single values as an array
        // https://github.com/fastify/fastify/blob/main/docs/Validation-and-Serialization.md
        coerceTypes: 'array',
      }
    }
  });*/

  if (METRICS_PLUGIN) {
    await instance.register(fp(metricsPlugin), {
      sentry: {
        enable: Boolean(SENTRY_DSN),
        dsn: SENTRY_DSN,
        enableProfiling: SENTRY_ENABLE_PROFILING,
        profilesSampleRate: SENTRY_PROFILES_SAMPLE_RATE,
        tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
      },
    });
    const { metrics } = instance;
    metrics.store.set('main', metrics.start({ name: 'main', description: 'Server start' }));
  }

  instance.register(fastifyHelmet);
  // fastifyApp.register(fastifyCompress);

  if (CORS_ORIGIN_REGEX) {
    instance.decorate('corsPluginOptions', {
      origin: [new RegExp(CORS_ORIGIN_REGEX)],
      credentials: true, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials
      maxAge: 7200, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
    });
  }

  await registerAppPlugins(instance);

  try {
    await instance.listen(+PORT, HOSTNAME);
    instance.log.info('App is running %s mode', ENVIRONMENT);
  } catch (err) {
    instance.log.error(err);
    instance.metrics?.store?.get('main')?.capture(err);
    process.exit(1);
  } finally {
    instance.metrics?.store?.get('main')?.stop();
  }
};

start();
