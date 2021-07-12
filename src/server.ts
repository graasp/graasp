import fastifyApp from './app';
import fastifyCors from 'fastify-cors';
import fastifyHelmet from 'fastify-helmet';
// import fastifyCompress from 'fastify-compress';
import { PORT, ENVIRONMENT, HOSTNAME, PROD, STAGING } from './util/config';

const start = async () => {
  try {
    fastifyApp.register(fastifyHelmet);
    // fastifyApp.register(fastifyCompress);

    if (STAGING || PROD) {
      fastifyApp.register(fastifyCors, {
        origin: new RegExp(`https?:\/\/^(([a-z0-9]+\.)+)?${HOSTNAME.replace(/\./g, '\\.')}$`),
        credentials: true, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials
        maxAge: 7200 // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
      });
    }

    await fastifyApp.listen(+PORT, HOSTNAME);
    fastifyApp.log.info('App is running %s mode', ENVIRONMENT);

  } catch (err) {
    fastifyApp.log.error(err);
    process.exit(1);
  }
};

start();
