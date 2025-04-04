import { fastifyCors } from '@fastify/cors';
import { FastifyPluginAsync } from 'fastify';

import { MEMBER_PROFILE_ROUTE_PREFIX } from '../../utils/config';
import memberController from './member.controller';
import actionMemberPlugin from './plugins/action/memberAction.controller';
import memberExportDataPlugin from './plugins/export-data/memberExportData.controller';
import memberProfilePlugin from './plugins/profile/memberProfile.controller';
import memberThumbnailPlugin from './plugins/thumbnail/memberThumbnail.controller';

const ROUTES_PREFIX = '/members';

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(
    async function (fastify) {
      // add CORS support
      if (fastify.corsPluginOptions) {
        await fastify.register(fastifyCors, fastify.corsPluginOptions);
      }

      fastify.register(actionMemberPlugin);

      // routes
      fastify.register(memberController);

      fastify.register(memberThumbnailPlugin);
      fastify.register(memberProfilePlugin, { prefix: MEMBER_PROFILE_ROUTE_PREFIX });
      fastify.register(memberExportDataPlugin);
    },
    { prefix: ROUTES_PREFIX },
  );
};

export default plugin;
