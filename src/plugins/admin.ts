import fastifyCors from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import '@graasp/sdk';
import adminPlugin, {
  itemPlugin as adminItemPlugin,
  memberPlugin as adminMemberPlugin,
} from 'graasp-plugin-admin';

import { ADMIN_ROLE_ID } from '../util/config';

export interface AdminPluginOptions {
  uri?: string;
  logs?: boolean;
}

const plugin: FastifyPluginAsync<AdminPluginOptions> = async (fastify) => {
  fastify.register(
    async (fastify) => {
      // add CORS support
      if (fastify.corsPluginOptions) {
        fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      await fastify.register(adminPlugin, { adminRoleId: ADMIN_ROLE_ID });

      // following endpoints are available only to admins
      fastify.addHook('preHandler', fastify.verifyAuthentication);
      fastify.addHook('preHandler', fastify.admin.verifyIsAdmin);

      await fastify.register(
        async (fastify) => {
          await fastify.register(adminItemPlugin);
        },
        { prefix: '/items' },
      );

      await fastify.register(
        async (fastify) => {
          await fastify.register(adminMemberPlugin);
        },

        { prefix: '/members' },
      );
    },
    { prefix: '/admin' },
  );
};
export default plugin;
