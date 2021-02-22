// global
import { FastifyPluginAsync } from 'fastify';
import { IdParam } from '../../interfaces/requests';
// local
import { EmailParam } from './interfaces/requests';
import common, { getOne, getBy } from './schemas';
import { MemberTaskManager } from './task-manager';

const ROUTES_PREFIX = '/members';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { members, taskRunner: runner } = fastify;
  const { dbService } = members;
  const taskManager = new MemberTaskManager(dbService);
  members.taskManager = taskManager;

  // schemas
  fastify.addSchema(common);

  // routes
  fastify.register(async function (fastify) {
    // auth plugin session validation
    fastify.addHook('preHandler', fastify.validateSession);

    // get member
    fastify.get<{ Params: IdParam }>(
      '/:id', { schema: getOne },
      async ({ member, params: { id }, log }) => {
        const task = taskManager.createGetTask(member, id);
        return runner.run([task], log);
      }
    );

    // get members by
    fastify.get<{ Querystring: EmailParam }>(
      '/', { schema: getBy },
      async ({ member, query: { email }, log }) => {
        const task = taskManager.createGetMembersByTask(member, { email });
        return runner.run([task], log);
      }
    );

  }, { prefix: ROUTES_PREFIX });
};

export default plugin;
