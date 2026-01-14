import { fastifyHelmet } from '@fastify/helmet';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { fastify } from 'fastify';

import registerAppPlugins from './app';
import { bustFileCache } from './bustCache';
import { DEV, NODE_ENV, PROD } from './config/env';
import { client } from './drizzle/db';
import ajvFormats from './schemas/ajvFormats';
import { initSentry } from './sentry';
import { APP_VERSION, CORS_ORIGIN_REGEX, HOST_LISTEN_ADDRESS, PORT } from './utils/config';
import { GREETING } from './utils/constants';
import { queueDashboardPlugin } from './workers/dashboard.controller';

export const instance = fastify({
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
      // This enables the use of discriminator keyword in oneof or anyof in schemas so it optimizes validation.
      discriminator: true,
    },
    plugins: [ajvFormats],
  },
}).withTypeProvider<TypeBoxTypeProvider>();

// On close, close database connection
instance.addHook('onClose', async () => {
  await client.end();
});

const start = async () => {
  const { Sentry } = initSentry(instance);

  instance.register(fastifyHelmet);

  if (CORS_ORIGIN_REGEX) {
    instance.decorate('corsPluginOptions', {
      origin: [new RegExp(CORS_ORIGIN_REGEX)],
      credentials: true, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials
      maxAge: 7200, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
      methods: ['HEAD', 'GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    });
  }

  await registerAppPlugins(instance);

  instance.register(queueDashboardPlugin);

  try {
    await instance.listen({ port: PORT, host: HOST_LISTEN_ADDRESS });
    instance.log.info('App is running version %s in %s mode', APP_VERSION, NODE_ENV);
    if (DEV) {
      // greet the world
      // eslint-disable-next-line no-console
      console.log(`${GREETING}`);
      await bustFileCache();
    }
  } catch (err) {
    instance.log.error(err);
    Sentry?.withScope((_scope) => {
      Sentry?.captureException(err);
    });
    process.exit(1);
  }
  return instance;
};

export default start;
