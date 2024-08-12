import { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../../../../di/utils';
import common from './schemas';
import { MembershipRequestService } from './service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db: _db } = fastify;

  const _membershipRequestService = resolveDependency(MembershipRequestService);

  // schemas
  fastify.addSchema(common);
};
export default plugin;
