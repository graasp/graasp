// global
import { FastifyPluginAsync } from 'fastify';
import { IdParam } from '../../interfaces/requests';
// local
import { MemberTaskManager } from './interfaces/member-task-manager';
import { EmailParam } from './interfaces/requests';
import common, { getOne, getBy, updateOne } from './schemas';
import { TaskManager } from './task-manager';

const ROUTES_PREFIX = '/members';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { members, taskRunner: runner } = fastify;
  const { dbService } = members;
  const taskManager: MemberTaskManager = new TaskManager(dbService);
  members.taskManager = taskManager;

  // schemas
  fastify.addSchema(common);

  // routes
  fastify.register(async function (fastify) {
    // auth plugin session validation
    fastify.addHook('preHandler', fastify.verifyAuthentication);

    // get current
    fastify.get('/current', async ({ member }) => member);

    // get member
    fastify.get<{ Params: IdParam }>(
      '/:id', { schema: getOne },
      async ({ member, params: { id }, log }) => {
        const task = taskManager.createGetTask(member, id);
        return runner.runSingle(task, log);
      }
    );

    // get members by
    fastify.get<{ Querystring: EmailParam }>(
      '/', { schema: getBy },
      async ({ member, query: { email }, log }) => {
        const task = taskManager.createGetByTask(member, { email });
        return runner.runSingle(task, log);
      }
    );

    // update member
    fastify.patch<{ Params: IdParam }>(
      '/:id', { schema: updateOne },
      async ({ member, params: { id }, body, log }) => {
        const task = taskManager.createUpdateTask(member, id, body);
        return runner.runSingle(task, log);
      }
    );

  }, { prefix: ROUTES_PREFIX });
};

export default plugin;
