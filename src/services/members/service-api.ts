// global
import { FastifyInstance } from 'fastify';
import { IdParam } from 'interfaces/requests';
// local
import common, {
  getOne,
} from './schemas';
import { MemberTaskManager } from './task-manager';

export default async (fastify: FastifyInstance) => {
  const { db, log, memberService: iS } = fastify;
  const taskManager = new MemberTaskManager(iS, db, log);

  // schemas
  fastify.addSchema(common);

  // get item
  fastify.get<{ Params: IdParam }>(
    '/:id', { schema: getOne },
    async ({ member, params: { id } }) => {
      const task = taskManager.createGetTask(member, id);
      return taskManager.run([task]);
    }
  );
};
