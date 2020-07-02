import fastifyApp from 'app';
// import swagger from 'fastify-swagger';
import { PORT, ENVIRONMENT } from 'util/config';

const start = async () => {
  try {
    // fastifyApp.register(swagger, { exposeRoute: true });

    await fastifyApp.listen(+PORT);
    fastifyApp.log.info('App is running %s mode', ENVIRONMENT);

    // application.swagger();
  } catch (err) {
    fastifyApp.log.error(err);
    process.exit(1);
  }
};

start();
