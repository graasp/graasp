import {
  Actor,
  DatabaseTransactionHandler,
  Item,
  ItemMembershipTaskManager,
  ItemTaskManager,
  ItemType,
  TaskRunner,
  UnknownExtra,
} from '@graasp/sdk';
import cs from 'checksum';
import FormData from 'form-data';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import tmp, { DirectoryResult } from 'tmp-promise';
import { createMock } from 'ts-auto-mock';
import util from 'util';

import fastify, { FastifyInstance, FastifyLoggerInstance } from 'fastify';

import plugin from '../src/service-api';
import {
  H5P_PACKAGES,
  MOCK_ITEM,
  MOCK_MEMBER,
  MOCK_MEMBERSHIP,
  mockParentId,
  mockTask,
} from './fixtures';

type Awaited<T> = T extends PromiseLike<infer U> ? U : T;
export type BuildAppType = Awaited<ReturnType<typeof buildApp>>;
export type CoreSpiesType = ReturnType<typeof mockCoreServices>;

const checksum = {
  file: util.promisify(cs.file),
};

/**
 * Builds a base fastify instance for testing the H5P plugin
 */
export async function buildApp(args?: {
  options?: {
    pathPrefix?: string;
    storageRootPath?: string;
    extractionRootPath?: string;
  };
  services?: {
    itemTaskManager?: ItemTaskManager;
    itemMembershipTaskManager?: ItemMembershipTaskManager;
    taskRunner?: TaskRunner<Actor>;
    dbTrxHandler?: DatabaseTransactionHandler;
    logger?: FastifyLoggerInstance;
  };
}) {
  const { options, services } = args ?? {};

  const tmpDirs: Array<DirectoryResult> = [];
  async function tmpDir(options: any = { unsafeCleanup: true }) {
    const entry = await tmp.dir(options);
    tmpDirs.push(entry);
    return entry.path;
  }

  const pathPrefix = options?.pathPrefix ?? 'h5p';
  const storageRootPath = options?.storageRootPath ?? (await tmpDir());
  const extractionRootPath = options?.extractionRootPath ?? (await tmpDir());

  /* mocks */
  const itemTaskManager = services?.itemTaskManager ?? createMock<ItemTaskManager>();
  const itemMembershipTaskManager =
    services?.itemMembershipTaskManager ?? createMock<ItemMembershipTaskManager>();
  const taskRunner = services?.taskRunner ?? createMock<TaskRunner<Actor>>();
  const dbTrxHandler = services?.dbTrxHandler ?? createMock<DatabaseTransactionHandler>();
  const logger = services?.logger ?? createMock<FastifyLoggerInstance>();

  const app = fastify();

  app.decorate('db', { pool: dbTrxHandler });
  app.decorate('items', { taskManager: itemTaskManager });
  app.decorate('itemMemberships', { taskManager: itemMembershipTaskManager });
  app.decorate('taskRunner', taskRunner);
  app.addHook('onRequest', async (request) => (request.member = MOCK_MEMBER));

  // uuid schema referenced from h5pImport schema should be registered by core
  // we use a simple string schema instead
  app.addSchema({
    $id: 'http://graasp.org/',
    type: 'object',
    definitions: {
      uuid: { type: 'string' },
    },
  });

  const registerH5PPlugin = async () =>
    await app.register(plugin, {
      fileItemType: ItemType.LOCAL_FILE,
      fileConfigurations: {
        local: {
          storageRootPath,
        },
        // todo: file service refactor should not require both configs
        s3: {
          s3Region: 'mock-s3-region',
          s3Bucket: 'mock-s3-bucket',
          s3AccessKeyId: 'mock-s3-access-key-id',
          s3SecretAccessKey: 'mock-s3-secret-access-key',
        },
      },
      pathPrefix,
      tempDir: extractionRootPath,
    });

  const cleanup = async () => {
    return Promise.all(tmpDirs.map(async (dir) => await dir.cleanup()));
  };

  return {
    app,
    registerH5PPlugin,
    options: {
      pathPrefix,
      storageRootPath,
      extractionRootPath,
    },
    services: {
      itemTaskManager,
      itemMembershipTaskManager,
      taskRunner,
      dbTrxHandler,
      logger,
    },
    cleanup,
  };
}

/**
 * Injects a test client request to import an H5P file
 */
export function injectH5PImport(
  app: FastifyInstance,
  options?: { filePath?: string; parentId?: string },
) {
  const { filePath, parentId } = options ?? {};

  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath ?? H5P_PACKAGES.ACCORDION.path));

  return app.inject({
    method: 'POST',
    url: '/h5p-import',
    payload: formData,
    headers: formData.getHeaders(),
    query: { parentId: parentId ?? mockParentId },
  });
}

/**
 * Helper to expect correct H5P upload
 */
export async function expectH5PFiles(
  h5p: { path: string; manifest: unknown },
  storageRootPath: string,
  pathPrefix: string,
  contentId: string,
) {
  // root extraction folder exists
  const root = path.resolve(storageRootPath, pathPrefix, contentId);
  expect(fs.existsSync(root)).toBeTruthy();

  // .h5p package exists and is same file as original
  const fileName = path.basename(h5p.path);
  const h5pFile = path.resolve(root, fileName);
  expect(fs.existsSync(h5pFile)).toBeTruthy();
  expect(await checksum.file(h5pFile)).toEqual(await checksum.file(h5p.path));

  // content folder exists
  const contentFolder = path.resolve(root, 'content');
  expect(fs.existsSync(contentFolder)).toBeTruthy();

  // h5p.json manifest file exists and is same file as original
  const manifestFile = path.resolve(contentFolder, 'h5p.json');
  expect(fs.existsSync(manifestFile)).toBeTruthy();
  const parsedManifest = JSON.parse(await fsp.readFile(manifestFile, { encoding: 'utf-8' }));
  expect(parsedManifest).toEqual(h5p.manifest);
}

/**
 * Helper to mock base functionality
 */
export function mockCoreServices(build: BuildAppType) {
  const {
    services: { itemTaskManager, itemMembershipTaskManager, taskRunner, dbTrxHandler, logger },
  } = build;

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
    .mockImplementation((task) => task.run(dbTrxHandler, logger));

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

  return {
    createItem,
    getItem,
    getMembership,
    runSingle,
    runSingleSequence,
    setTaskPreHookHandler,
    setTaskPostHookHandler,
  };
}
