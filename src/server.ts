import fastifyHelmet from '@fastify/helmet';
import fastify from 'fastify';

import registerAppPlugins from './app';
import { initSentry } from './sentry';
// import fastifyCompress from 'fastify-compress';
import { CORS_ORIGIN_REGEX, DEV, DISABLE_LOGS, ENVIRONMENT, HOSTNAME, PORT } from './util/config';

const start = async () => {
  const instance = fastify({
    logger: DEV ?? DISABLE_LOGS,
    ajv: {
      customOptions: {
        // This allow routes that take array to correctly interpret single values as an array
        // https://github.com/fastify/fastify/blob/main/docs/Validation-and-Serialization.md
        coerceTypes: 'array',
      },
    },
  });

  const { SentryConfig, Sentry } = initSentry(instance);

  instance.register(fastifyHelmet);
  // fastifyApp.register(fastifyCompress);

  if (CORS_ORIGIN_REGEX) {
    instance.decorate('corsPluginOptions', {
      origin: [new RegExp(CORS_ORIGIN_REGEX)],
      credentials: true, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials
      maxAge: 7200, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
    });
  }

  // await registerAppPlugins(instance);

  const mainMetric = SentryConfig.enable
    ? Sentry.startTransaction({
        op: 'main',
        name: 'Main server listen',
      })
    : null;

  try {
    console.log({ port: +PORT, host: HOSTNAME });
    await instance.listen({ port: +PORT, host: HOSTNAME });
    instance.log.info('App is running %s mode', ENVIRONMENT);
  } catch (err) {
    console.log('ERROR!!!',err);
    instance.log.error(err);
    Sentry?.withScope((scope) => {
      scope.setSpan(mainMetric);
      scope.setTransactionName(mainMetric.name);
      Sentry?.captureException(err);
    });
    process.exit(1);
  } finally {
    mainMetric?.finish();
  }
};

start();
