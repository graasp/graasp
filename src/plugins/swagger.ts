import swaggerPlugin from '@fastify/swagger';
import swaggerUiPlugin from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

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
      tags: [
        { name: 'authentication', description: 'Endpoints related to authentication' },
        { name: 'app', description: 'Endpoints related to apps' },
        { name: 'app-action', description: 'Endpoints related to actions created in apps' },
        { name: 'app-data', description: 'Endpoints related to data created in apps' },
        { name: 'app-setting', description: 'Endpoints related to settings created in apps' },
        { name: 'capsule', description: 'Endpoints related to capsules' },
        { name: 'chat', description: 'Endpoints related to chats' },
        { name: 'app-chatbot', description: 'Endpoints related to chatbots in apps' },
        { name: 'current', description: 'Endpoints related to current user' },
        { name: 'email', description: 'Endpoints related to management of emails' },
        { name: 'etherpad', description: 'Endpoints related to etherpad' },
        { name: 'export', description: 'Endpoints related to exporting and downloading data' },
        { name: 'favorite', description: 'Endpoints related to bookmarked items' },
        { name: 'file', description: 'Endpoints related to file management' },
        {
          name: 'flag',
          description: 'Endpoints related to flagged items (report items to graasp admins)',
        },
        {
          name: 'guest',
          description: 'Endpoints related to guests',
        },
        { name: 'h5p', description: 'Endpoints related to H5P items' },
        { name: 'invitation', description: 'Endpoints related to invitations in items' },
        { name: 'item', description: 'Endpoints related to items' },
        {
          name: 'import',
          description:
            'Endpoints related to bulk creation of content via archive files for example',
        },
        {
          name: 'item-login',
          description: 'Endpoints related to access for users without a graasp account (guests)',
        },
        {
          name: 'item-membership',
          description: 'Endpoints related to memberships of users over items',
        },
        { name: 'like', description: 'Endpoints related to liked items' },
        { name: 'member', description: 'Endpoints related to members' },
        {
          name: 'membership-request',
          description: 'Endpoints related to request to access items',
        },
        { name: 'mention', description: 'Endpoints related to mentions in chat' },
        { name: 'meta', description: 'Endpoints related to system health and monitoring' },
        {
          name: 'password',
          description: 'Endpoints related to authentication and management of password',
        },
        {
          name: 'profile',
          description: 'Endpoints related to user profile',
        },
        { name: 'recycled', description: 'Endpoints related to recycled items' },
        { name: 'short-link', description: 'Endpoints related to short links to item' },
        { name: 'visibility', description: 'Endpoints related to item visibility' },
        { name: 'thumbnail', description: 'Endpoints related to item thumbnails' },
      ],
    },
    refResolver: {
      // This function allows to define meaningful names for schema definitions in an OpenAPI specification,
      // which will also facilitate automatic API generation, documentation and code readability.
      // Example: If the schema defines a `user` object with `$id` = `user`, it will result in
      // $ref: "#/components/schemas/user" instead of "#/components/schemas/def-1"
      buildLocalReference(json, baseUri, fragment, i) {
        return json.$id?.toString() ?? `my-fragment-${i}`;
      },
    },
  });

  await instance.register(swaggerUiPlugin, {
    routePrefix: '/api/docs',
    transformSpecification: (swaggerObject, _request, _reply) => {
      return swaggerObject;
    },
  });
}
