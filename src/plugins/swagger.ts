import swaggerPlugin from '@fastify/swagger';
import swaggerUiPlugin from '@fastify/swagger-ui';
import { FastifyInstance } from 'fastify';

import { APP_VERSION } from '../utils/config';

export default async function (instance: FastifyInstance): Promise<void> {
  await instance.register(swaggerPlugin, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Graasp Backend API',
        version: APP_VERSION ?? ' ',
        description: 'Graasp Backend API used to serve data to frontend applications',
      },
    },
  });

  await instance.register(swaggerUiPlugin, {
    routePrefix: '/docs',
    transformSpecification: (swaggerObject, _request, _reply) => {
      return swaggerObject;
    },
  });
}
