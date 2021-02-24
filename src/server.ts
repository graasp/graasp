import fastifyApp from './app';
import fastifyCors from 'fastify-cors';
import fastifyCompress from 'fastify-compress';
// import swagger from 'fastify-swagger';
import { PORT, ENVIRONMENT, HOSTNAME } from './util/config';

const start = async () => {
  try {
    // fastifyApp.register(swagger, { exposeRoute: true });
    fastifyApp.register(fastifyCompress);

    if (ENVIRONMENT === 'staging') {
      fastifyApp.register(fastifyCors, {
        origin: new RegExp(`\.graasp\.org:${PORT}$`),
        credentials: true, // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Credentials
        maxAge: 7200 // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Max-Age
      });
    }

    await fastifyApp.listen(+PORT, HOSTNAME);
    fastifyApp.log.info('App is running %s mode', ENVIRONMENT);

    // fastifyApp.swagger();
  } catch (err) {
    fastifyApp.log.error(err);
    process.exit(1);
  }
};

start();
