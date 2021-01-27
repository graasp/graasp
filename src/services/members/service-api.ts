// global
import { FastifyPluginAsync } from 'fastify';
import { IdParam } from '../../interfaces/requests';
// local
import { EmailParam } from './interfaces/requests';
import common, { getOne, getBy } from './schemas';
import { MemberTaskManager } from './task-manager';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { memberService: iS, taskRunner: runner } = fastify;
  const taskManager = new MemberTaskManager(iS);

  // schemas
  fastify.addSchema(common);

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
      const task = taskManager.createGetByTask(member, { email });
      return runner.run([task], log);
    }
  );
};

export default plugin;
