import fastify from 'fastify';
import fastifyHelmet from 'fastify-helmet';
import registerAppPlugins from './app';
// import fastifyCompress from 'fastify-compress';
import {
  PORT,
  ENVIRONMENT,
  HOSTNAME,
  PROD,
  STAGING,
  CORS_ORIGIN_REGEX,
  DISABLE_LOGS,
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

  instance.register(fastifyHelmet);
  // fastifyApp.register(fastifyCompress);

  if ((STAGING || PROD) && CORS_ORIGIN_REGEX) {
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
    process.exit(1);
  }
};

start();
