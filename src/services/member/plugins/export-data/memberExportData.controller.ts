import { StatusCodes } from 'http-status-codes';

import type { FastifyPluginAsync } from 'fastify';

import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { MEMBER_EXPORT_DATA_ROUTE_PREFIX } from '../../../../utils/config';
import { isAuthenticated, matchOne } from '../../../auth/plugins/passport';
import { assertIsMember } from '../../../authentication';
import { MemberRepository } from '../../member.repository';
import { memberAccountRole } from '../../strategies/memberAccountRole';
import { exportMemberData } from './memberExportData.schemas';
import { ExportMemberDataService } from './memberExportData.service';

const plugin: FastifyPluginAsync = async (fastify) => {
  const exportMemberDataService = resolveDependency(ExportMemberDataService);
  const memberRepository = resolveDependency(MemberRepository);

  await fastify.register(
    async function (fastify) {
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
    },
    { prefix: MEMBER_EXPORT_DATA_ROUTE_PREFIX },
  );
};

export default plugin;
