import {FastifyPluginAsync} from 'fastify';
import {TaskManager} from './task-manager';
import {create, getMany} from './schemas';
import {IdParam, IdsParams, ParentIdParam} from '../../interfaces/requests';

const ROUTES_PREFIX = '/groups';

const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    items: {dbService: dbServiceI},
    members: {dbService: dbServiceM},
    itemMemberships: {dbService: dbServiceIM},
    groupMemberships: {dbService: dbServiceGM},
    groups,
    taskRunner: runner
  } = fastify;

  const { dbService:dbServiceG } = groups;

  const groupTaskManager = new TaskManager(dbServiceM,dbServiceI,dbServiceG,dbServiceIM,dbServiceGM);

  groups.taskManager = groupTaskManager;

  fastify.register(async function (fastify) {

    fastify.addHook('preHandler', fastify.verifyAuthentication);


    fastify.post<{ Querystring: ParentIdParam }>(
      '/', { schema: create },
      async ({ member,query: { parentId },log, body }) => {
            console.log(parentId);
            const task = groupTaskManager.createCreateTask(member,body,parentId);
            return runner.runSingle(task, log);
      }
    );

    fastify.get<{ Querystring: IdsParams }>(
      '/',{ schema: getMany},
      async ({member,query: { id:ids},log}) => {
        const tasks = ids.map(id => groupTaskManager.createGetTask(member, id));
        return runner.runMultiple(tasks, log);
      }
    );

    fastify.get(
      '/root',
      async ({member,log}) => {
        const task = groupTaskManager.createGetRootGroupsTask(member);
        return runner.runSingle(task, log);
      }
    );

    fastify.get<{ Params: IdParam }>(
      '/:id',
      async ({member,params: { id},log}) => {
        const task = groupTaskManager.createGetTask(member, id);
        return runner.runSingle(task, log);
      }
    );

    fastify.get<{ Params: IdParam }>(
      '/:id/children',
      async ({member,params: { id},log}) => {
        const task = groupTaskManager.createGetChildrenTask(member, id);
        return runner.runSingle(task, log);
      }
    );
  }, { prefix: ROUTES_PREFIX });
};

export default plugin;
