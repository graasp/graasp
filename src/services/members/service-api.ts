// global
import { FastifyPluginAsync } from 'fastify';
import { IdParam } from '../../interfaces/requests';
// local
import { EmailParam } from './interfaces/requests';
import common, { getOne, getBy } from './schemas';
import { MemberTaskManager } from './task-manager';

const plugin: FastifyPluginAsync = async (fastify) => {
  const { db, log, memberService: iS } = fastify;
  const taskManager = new MemberTaskManager(iS, db, log);

  // schemas
  fastify.addSchema(common);

  // get member
  fastify.get<{ Params: IdParam }>(
    '/:id', { schema: getOne },
    async ({ member, params: { id }, log }) => {
      const task = taskManager.createGetTask(member, id);
      return taskManager.run([task], log);
    }
  );

  // get members by
  fastify.get<{ Querystring: EmailParam }>(
    '/', { schema: getBy },
    async ({ member, query: { email }, log }) => {
      const task = taskManager.createGetByTask(member, { email });
      return taskManager.run([task], log);
    }
  );
};

export default plugin;
