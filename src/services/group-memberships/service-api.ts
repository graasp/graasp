import common, {create} from './schemas';
import {FastifyPluginAsync} from 'fastify';
import {TaskManager} from './task-manager';


const ROUTES_PREFIX = '/group-memberships';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    items: {dbService: dbServiceI},
    members: {dbService: dbServiceM},
    groupMemberships: { dbService: dbServiceGM},
    itemMemberships: {dbService: dbServiceIM},
    taskRunner: runner
  } = fastify;

  const groupMembershipsTaskManager = new TaskManager(dbServiceI,dbServiceM,dbServiceGM,dbServiceIM);

  fastify.addSchema(common);

  fastify.register(async function (fastify) {

    fastify.addHook('preHandler', fastify.verifyAuthentication);

    fastify.post<{ Querystring: { groupId: string }, Body: {member: string} }>(
      '/', { schema: create },
      async ({ member, query: {groupId},log, body }) => {
        const task = groupMembershipsTaskManager.createCreateTask(member,body,groupId);
        return runner.runSingle(task,log);
      }
    );

    fastify.get(
      '/own',
      async ({member,log}) => {
        const task = groupMembershipsTaskManager.createGetTask(member);
        return runner.runSingle(task,log);
      }
    );
  }, { prefix: ROUTES_PREFIX });
};

export default plugin;
