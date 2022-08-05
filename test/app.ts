import fastify from 'fastify';

import registerAppPlugins from '../src/app';

const build = async (opts = {}) => {
  // const app = fastify({
  //   logger: {
  //     prettyPrint: true,
  //     level: 'debug',
  //   },
  //   ajv: {
  //     customOptions: {
  //       coerceTypes: 'array',
  //     },
  //   },
  // });
  const app = fastify({
    logger: false,
    ajv: {
      customOptions: {
        coerceTypes: 'array',
      },
    },
  });

  await registerAppPlugins(app);

  return app;
};

export default build;
