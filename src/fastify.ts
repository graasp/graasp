import { fastifyHelmet } from '@fastify/helmet';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { fastify } from 'fastify';

import registerAppPlugins from './app';
import ajvFormats from './schemas/ajvFormats';
import { initSentry } from './sentry';
import {
  APP_VERSION,
  CORS_ORIGIN_REGEX,
  DEV,
  ENVIRONMENT,
  HOSTNAME,
  PORT,
  PROD,
} from './utils/config';
import { GREETING } from './utils/constants';

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

const start = async () => {
  const { Sentry } = initSentry(instance);

  instance.register(fastifyHelmet);

  if (CORS_ORIGIN_REGEX) {
    instance.decorate('corsPluginOptions', {
      origin: [new RegExp(CORS_ORIGIN_REGEX)],
      credentials: true, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials
      maxAge: 7200, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
    });
  }

  await registerAppPlugins(instance);

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
      Sentry?.captureException(err);
    });
    process.exit(1);
  }
  return instance;
};

export default start;
