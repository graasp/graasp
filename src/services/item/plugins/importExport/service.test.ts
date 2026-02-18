import * as nodeFetch from 'node-fetch';
import { ZipFile } from 'yazl';

import { FastifyInstance, FastifyReply } from 'fastify';

import { ItemType, ItemVisibilityType } from '@graasp/sdk';

import build, {
  MOCK_LOGGER,
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { resolveDependency } from '../../../../di/utils';
import { BaseLogger } from '../../../../logger';
import { buildRepositories } from '../../../../utils/repositories';
import { saveMember } from '../../../member/test/fixtures/members';
import { ItemService } from '../../service';
import { ItemTestUtils } from '../../test/fixtures/items';
import FileItemService from '../file/service';
import { ItemVisibilityRepository } from '../itemVisibility/repository';
import { ImportExportService } from './service';

const testUtils = new ItemTestUtils();

describe('ZIP routes tests', () => {
  let app: FastifyInstance;
  let actor;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    unmockAuthenticate();
    jest.clearAllMocks();
  });

  describe('export', () => {
    it('Do not include hidden children', async () => {
      actor = await saveMember();
      mockAuthenticate(actor);
      const mock = jest.spyOn(ZipFile.prototype, 'addEmptyDirectory');
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
      });
      const child1 = await testUtils.saveItem({
        actor,
        parentItem: item,
      });
      await testUtils.saveItem({
        actor,
        parentItem: item,
      });
      await new ItemVisibilityRepository().post(actor, child1, ItemVisibilityType.Hidden);

      const importExportService = new ImportExportService(
        app.db,
        {} as unknown as FileItemService,
        resolveDependency(ItemService),
        resolveDependency(BaseLogger),
      );
      const repositories = buildRepositories();
      const reply = {} as unknown as FastifyReply;
      await importExportService.export(actor, repositories, { item, reply }, MOCK_LOGGER);

      // called for parent and one child
      expect(mock).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchItemData', () => {
    it('fetch file data', async () => {
      jest.spyOn(nodeFetch, 'default').mockImplementation(
        async () =>
          ({
            body: new Blob([]),
          }) as unknown as nodeFetch.Response,
      );

      actor = await saveMember();
      mockAuthenticate(actor);
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        item: {
          type: ItemType.LOCAL_FILE,
          extra: {
            [ItemType.LOCAL_FILE]: {
              mimetype: 'image/png',
              name: 'name',
              path: 'path',
              size: 111,
              content: 'content',
            },
          },
        },
      });
      const importExportService = new ImportExportService(
        app.db,
        {
          getUrl: jest.fn(),
        } as unknown as FileItemService,
        resolveDependency(ItemService),
        resolveDependency(BaseLogger),
      );
      const repositories = buildRepositories();
      const res = await importExportService.fetchItemData(actor, repositories, item);

      expect(res.name).toEqual(item.name + '.png');
      expect(res.stream).toBeDefined();
      expect(res.mimetype).toEqual('image/png');
    });
    it('fetch app data', async () => {
      actor = await saveMember();
      mockAuthenticate(actor);
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        item: {
          type: ItemType.APP,
        },
      });
      const importExportService = new ImportExportService(
        app.db,
        {} as unknown as FileItemService,
        resolveDependency(ItemService),
        resolveDependency(BaseLogger),
      );
      const repositories = buildRepositories();
      const res = await importExportService.fetchItemData(actor, repositories, item);

      expect(res.name).toEqual(item.name + '.app');
      expect(res.stream).toBeDefined();
      expect(res.mimetype).toEqual('text/plain');
    });
    it('fetch link data', async () => {
      actor = await saveMember();
      mockAuthenticate(actor);
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        item: {
          type: ItemType.LINK,
        },
      });
      const importExportService = new ImportExportService(
        app.db,
        {} as unknown as FileItemService,
        resolveDependency(ItemService),
        resolveDependency(BaseLogger),
      );
      const repositories = buildRepositories();
      const res = await importExportService.fetchItemData(actor, repositories, item);

      expect(res.name).toEqual(item.name + '.url');
      expect(res.stream).toBeDefined();
      expect(res.mimetype).toEqual('text/plain');
    });
    it('fetch document data', async () => {
      actor = await saveMember();
      mockAuthenticate(actor);
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        item: {
          type: ItemType.DOCUMENT,
        },
      });
      const importExportService = new ImportExportService(
        app.db,
        {} as unknown as FileItemService,
        resolveDependency(ItemService),
        resolveDependency(BaseLogger),
      );
      const repositories = buildRepositories();
      const res = await importExportService.fetchItemData(actor, repositories, item);

      expect(res.name).toEqual(item.name + '.graasp');
      expect(res.stream).toBeDefined();
      expect(res.mimetype).toEqual('text/plain');
    });
    it('fetch document-html data', async () => {
      actor = await saveMember();
      mockAuthenticate(actor);
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        item: {
          type: ItemType.DOCUMENT,
          extra: {
            document: {
              content: 'hello',
              isRaw: true,
            },
          },
        },
      });
      const importExportService = new ImportExportService(
        app.db,
        {} as unknown as FileItemService,
        resolveDependency(ItemService),
        resolveDependency(BaseLogger),
      );
      const repositories = buildRepositories();
      const res = await importExportService.fetchItemData(actor, repositories, item);

      expect(res.name).toEqual(item.name + '.html');
      expect(res.stream).toBeDefined();
      expect(res.mimetype).toEqual('text/html');
    });
    it('throw for folder', async () => {
      actor = await saveMember();
      mockAuthenticate(actor);
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
      });
      const importExportService = new ImportExportService(
        app.db,
        {} as unknown as FileItemService,
        resolveDependency(ItemService),
        resolveDependency(BaseLogger),
      );
      const repositories = buildRepositories();

      await expect(() =>
        importExportService.fetchItemData(actor, repositories, item),
      ).rejects.toThrow();
    });
  });
});
