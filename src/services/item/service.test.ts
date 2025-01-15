import { FastifyInstance } from 'fastify';

import { FolderItemFactory } from '@graasp/sdk';

import build, { clearDatabase } from '../../../test/app';
import { BaseLogger } from '../../logger';
import { buildRepositories } from '../../utils/repositories';
import * as authorization from '../authorization';
import { ThumbnailService } from '../thumbnail/service';
import { Item } from './entities/Item';
import { ItemThumbnailService } from './plugins/thumbnail/service';
import { ItemService } from './service';
import { ItemTestUtils } from './test/fixtures/items';

const testUtils = new ItemTestUtils();
const mockedThumbnailService = {
  copyFolder: jest.fn(),
} as unknown as jest.Mocked<ThumbnailService>;
const service = new ItemService(
  mockedThumbnailService,
  {} as ItemThumbnailService,
  {} as BaseLogger,
);

describe('Item Service', () => {
  let app: FastifyInstance;
  let actor;

  beforeAll(async () => {
    ({ app, actor } = await build());
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });
  afterEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
    actor = null;
  });

  describe('get', () => {
    it('return item if exists and pass validation', async () => {
      const item = FolderItemFactory() as unknown as Item;
      const repositories = buildRepositories();
      jest.spyOn(repositories.itemRepository, 'getOneOrThrow').mockResolvedValue(item);
      jest
        .spyOn(authorization, 'validatePermission')
        .mockResolvedValue({ itemMembership: null, visibilities: [] });

      const result = await service.get(actor, repositories, item.id);
      expect(result).toEqual(item);
    });
    it('throw if item does not exists', async () => {
      const item = FolderItemFactory() as unknown as Item;
      const repositories = buildRepositories();
      jest.spyOn(repositories.itemRepository, 'getOneOrThrow').mockRejectedValue(new Error());

      await expect(() => service.get(actor, repositories, item.id)).rejects.toThrow();
    });
    it('throw if validation does not pass', async () => {
      const item = FolderItemFactory() as unknown as Item;
      const repositories = buildRepositories();
      jest.spyOn(repositories.itemRepository, 'getOneOrThrow').mockResolvedValue(item);
      jest.spyOn(authorization, 'validatePermission').mockRejectedValue(new Error());

      await expect(() => service.get(actor, repositories, item.id)).rejects.toThrow();
    });
  });
  describe('Copy', () => {
    it('Should copy thumbnails on item copy if original has thumbnails', async () => {
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        item: { settings: { hasThumbnail: true } },
      });
      await service.copy(actor, buildRepositories(), item.id);
      expect(mockedThumbnailService.copyFolder).toHaveBeenCalled();
    });
    it('Should not copy thumbnails on item copy if original has no thumbnails', async () => {
      const { item } = await testUtils.saveItemAndMembership({
        member: actor,
        item: { settings: { hasThumbnail: false } },
      });
      await service.copy(actor, buildRepositories(), item.id);
      expect(mockedThumbnailService.copyFolder).not.toHaveBeenCalled();
    });
  });
});
