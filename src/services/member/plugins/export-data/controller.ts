import { StatusCodes } from 'http-status-codes';

import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';

import { resolveDependency } from '../../../../di/utils.js';
import { db } from '../../../../drizzle/db.js';
import { asDefined } from '../../../../utils/assertions.js';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport/index.js';
import { assertIsMember } from '../../../authentication.js';
import { MemberRepository } from '../../member.repository.js';
import { memberAccountRole } from '../../strategies/memberAccountRole.js';
import { exportMemberData } from './schemas/schemas.js';
import { ExportMemberDataService } from './service.js';

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  const exportMemberDataService = resolveDependency(ExportMemberDataService);
  const memberRepository = resolveDependency(MemberRepository);

  // download all related data to the given user
  fastify.post(
    '/',
    {
      schema: exportMemberData,
      preHandler: [isAuthenticated, matchOne(memberAccountRole)],
    },
    async ({ user }, reply) => {
      const authedUser = asDefined(user?.account);
      assertIsMember(authedUser);
      // get member info such as email and lang
      const member = await memberRepository.get(db, authedUser.id);
      db.transaction(async (tx) => {
        await exportMemberDataService.requestDataExport(tx, member.toMemberInfo());
      });

      // reply no content and let the server create the archive and send the mail
      reply.status(StatusCodes.NO_CONTENT);
    },
  );
};

export default plugin;
