import { createMock } from 'ts-auto-mock';

import fastifyCookie from '@fastify/cookie';
import fastify, { FastifyLoggerInstance } from 'fastify';

import {
  Actor,
  DatabaseTransactionHandler,
  Item,
  ItemMembershipTaskManager,
  ItemTaskManager,
  TaskRunner,
  UnknownExtra,
} from '@graasp/sdk';

import plugin, { EtherpadPluginOptions } from '../src/';
import {
  COPY_ITEM_TASK_NAME,
  DELETE_ITEM_TASK_NAME,
  MOCK_ITEM,
  MOCK_MEMBER,
  MOCK_MEMBERSHIP,
  mockTask,
} from './fixtures';

type Awaited<T> = T extends PromiseLike<infer U> ? U : T;
export type BuildAppType = Awaited<ReturnType<typeof buildApp>>;

export async function buildApp(args?: { options?: EtherpadPluginOptions }) {
  const app = fastify({ logger: true });

  app.register(fastifyCookie);

  const itemTaskManager = createMock<ItemTaskManager>();
  const itemMembershipTaskManager = createMock<ItemMembershipTaskManager>();
  const taskRunner = createMock<TaskRunner<Actor>>();
  const dbTrxHandler = createMock<DatabaseTransactionHandler>();
  const logger = createMock<FastifyLoggerInstance>();

  app.decorate('items', { taskManager: itemTaskManager });
  app.decorate('itemMemberships', { taskManager: itemMembershipTaskManager });
  app.decorate('taskRunner', taskRunner);
  app.addHook('onRequest', async (request, reply) => {
    request.member = MOCK_MEMBER;
  });

  // uuid schema referenced from our schema should be registered by core
  // we use a simple string schema instead
  app.addSchema({
    $id: 'http://graasp.org/',
    type: 'object',
    definitions: {
      uuid: { type: 'string' },
    },
  });

  // mock core services and create spies on these
  jest.spyOn(itemTaskManager, 'getDeleteTaskName').mockImplementation(() => DELETE_ITEM_TASK_NAME);
  jest.spyOn(itemTaskManager, 'getCopyTaskName').mockImplementation(() => COPY_ITEM_TASK_NAME);

  const createItem = jest
    .spyOn(itemTaskManager, 'createCreateTaskSequence')
    .mockImplementation((actor, item, extra) => [
      mockTask<unknown>('MockCreateItemTask', actor, { ...MOCK_ITEM, ...item }),
    ]);

  const getItem = jest
    .spyOn(itemTaskManager, 'createGetTask')
    .mockImplementation((actor, id) =>
      mockTask<Item<UnknownExtra>>('MockGetItemTask', actor, MOCK_ITEM),
    );

  const getMembership = jest
    .spyOn(itemMembershipTaskManager, 'createGetMemberItemMembershipTask')
    .mockImplementation((member) =>
      mockTask('MockGetMemberItemMembershipTask', member, MOCK_MEMBERSHIP),
    );

  const runSingle = jest
    .spyOn(taskRunner, 'runSingle')
    .mockImplementation((task) => (task.run(dbTrxHandler, logger), Promise.resolve(task.result)));

  const runSingleSequence = jest
    .spyOn(taskRunner, 'runSingleSequence')
    .mockImplementation(async (tasks) => {
      tasks = [...tasks];
      for (const task of tasks) {
        await task.run(dbTrxHandler, logger);
      }
      return tasks.pop()?.result;
    });

  const setTaskPreHookHandler = jest.spyOn(taskRunner, 'setTaskPreHookHandler');

  const setTaskPostHookHandler = jest.spyOn(taskRunner, 'setTaskPostHookHandler');

  if (args?.options) await app.register(plugin, args.options);

  return {
    app,
    services: {
      itemTaskManager,
      itemMembershipTaskManager,
      taskRunner,
      dbTrxHandler,
      logger,
    },
    spies: {
      createItem,
      getItem,
      getMembership,
      runSingle,
      runSingleSequence,
      setTaskPreHookHandler,
      setTaskPostHookHandler,
    },
  };
}
