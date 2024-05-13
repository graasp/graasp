import fastifyHelmet from '@fastify/helmet';
import fastify from 'fastify';

import registerAppPlugins from './app';
import { initSentry } from './sentry';
import { APP_VERSION, CORS_ORIGIN_REGEX, DEV, ENVIRONMENT, HOSTNAME, PORT, PROD } from './utils/config';
// import fastifyCompress from 'fastify-compress';
import { GREETING } from './utils/constants';

const start = async () => {
  const instance = fastify({
    // allows to remove logging of incomming requests
    // can not be set using an environnement variable
    disableRequestLogging: false,
    logger: {
      // Do not use pino-pretty in production
      transport: PROD
        ? undefined
        : {
            target: 'pino-pretty',
          },
      level: process.env.LOG_LEVEL,
    },
    ajv: {
      customOptions: {
        // This allow routes that take array to correctly interpret single values as an array
        // https://github.com/fastify/fastify/blob/main/docs/Validation-and-Serialization.md
        coerceTypes: 'array',
      },
    },
  });

  const { Sentry } = initSentry(instance);

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

  // const mainMetric = SentryConfig.enable
  //   ? Sentry.startTransaction({
  //       op: 'main',
  //       name: 'Main server listen',
  //     })
  //   : null;

  try {
    await instance.listen({ port: PORT, host: HOSTNAME });
    instance.log.info('App is running version %s in %s mode', APP_VERSION, ENVIRONMENT);
    if (DEV) {
      // greet the world
      console.log(`${GREETING}`);
    }
  } catch (err) {
    instance.log.error(err);
    Sentry?.withScope((_scope) => {
      // scope.setSpan(mainMetric);
      // scope.setTransactionName(mainMetric.name);
      Sentry?.captureException(err);
    });
    process.exit(1);
  } finally {
    // mainMetric?.finish();
  }
};

start();
