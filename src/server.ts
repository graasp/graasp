import * as Sentry from '@sentry/node';
import { DataSource } from 'typeorm';

import fastifyHelmet from '@fastify/helmet';
import fastify from 'fastify';

import registerAppPlugins from './app';
import { Member } from './services/members/member';
// import fastifyCompress from 'fastify-compress';
import { CORS_ORIGIN_REGEX, DISABLE_LOGS, ENVIRONMENT, HOSTNAME, PORT } from './util/config';

// TODO: REMOVE
declare module 'fastify' {
  interface FastifyInstance {
    db: DataSource;
  }

  interface FastifyRequest {
    member: Member;
  }
}

// Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

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

  // fastify Sentry hook
  instance.addHook('onError', (request, reply, error, done) => {
    // Only send Sentry errors when not in development
    if (process.env.NODE_ENV !== 'development') {
      Sentry.captureException(error);
    }
    done();
  });

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
    await instance.listen({ port: +PORT, host: HOSTNAME });
    instance.log.info('App is running %s mode', ENVIRONMENT);
  } catch (err) {
    instance.log.error(err);
    process.exit(1);
  }
};

start();
