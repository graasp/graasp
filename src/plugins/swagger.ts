import swaggerPlugin from '@fastify/swagger';
import swaggerUiPlugin from '@fastify/swagger-ui';
import { FastifyInstance } from 'fastify';

import { APP_VERSION } from '../utils/config';

export default async function (instance: FastifyInstance): Promise<void> {
  await instance.register(swaggerPlugin, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Graasp Backend API',
        version: APP_VERSION ?? ' ',
        description: 'Graasp Backend API used to serve data to frontend applications',
      },
    },
    refResolver: {
      buildLocalReference(json, baseUri, fragment, i) {
        return json.$id?.toString() || `my-fragment-${i}`;
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
