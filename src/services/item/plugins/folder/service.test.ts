import { v4 } from 'uuid';

import { AppItemFactory, FolderItemFactory, ItemType, PermissionLevel } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app';
import { Item } from '../../../../drizzle/types';
import { MinimalMember } from '../../../../types';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
import { FolderItemService } from './service';

const folderService = new FolderItemService(
  {} as unknown as ThumbnailService,
  {} as unknown as ItemThumbnailService,
  {} as MeiliSearchWrapper,
  MOCK_LOGGER,
);
const id = v4();
const MOCK_ITEM = { id, type: ItemType.FOLDER } as Item;

const MOCK_MEMBER = {} as MinimalMember;
const itemRepository = {
  getOneOrThrow: async () => {
    return MOCK_ITEM;
  },
} as unknown as ItemRepository;

describe('Folder Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('return folder', async () => {
      const folderItem = FolderItemFactory() as unknown as Item;
      const itemServicePostMock = jest
        .spyOn(ItemService.prototype, 'get')
        .mockImplementation(async () => {
          return folderItem;
        });

      expect(await folderService.get(app.db, MOCK_MEMBER, folderItem.id)).toEqual(folderItem);

      expect(itemServicePostMock).toHaveBeenCalledWith(
        app.db,
        MOCK_MEMBER,

        folderItem.id,
        undefined,
      );
    });

    it('return folder for permission', async () => {
      const permission = PermissionLevel.Write;
      const folderItem = FolderItemFactory() as unknown as Item;
      const itemServicePostMock = jest
        .spyOn(ItemService.prototype, 'get')
        .mockImplementation(async () => {
          return folderItem;
        });

      expect(await folderService.get(app.db, MOCK_MEMBER, folderItem.id, permission)).toEqual(
        folderItem,
      );

      expect(itemServicePostMock).toHaveBeenCalledWith(
        app.db,
        MOCK_MEMBER,

        folderItem.id,
        permission,
      );
    });

    it('throw if item is not a folder', async () => {
      const appItem = AppItemFactory() as unknown as Item;
      jest.spyOn(ItemService.prototype, 'get').mockImplementation(async () => {
        return appItem;
      });

      await expect(() => folderService.get(app.db, MOCK_MEMBER, appItem.id)).rejects.toBeInstanceOf(
        WrongItemTypeError,
      );
    });
  });

  describe('post', () => {
    it('set correct type and extra', async () => {
      const itemServicePostMock = jest
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as Item;
        });

      await folderService.post(app.db, MOCK_MEMBER, { item: { name: 'name' } });

      expect(itemServicePostMock).toHaveBeenCalledWith(app.db, MOCK_MEMBER, {
        item: { name: 'name', extra: { [ItemType.FOLDER]: {} }, type: ItemType.FOLDER },
      });
    });
  });
  describe('patch', () => {
    it('throw if item is not a folder', async () => {
      await expect(() =>
        folderService.patch(app.db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' }),
      ).rejects.toThrow();
    });
    it('use item service patch', async () => {
      const itemServicePatchMock = jest
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      await folderService.patch(app.db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' });

      expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, MOCK_ITEM.id, {
        name: 'name',
      });
    });

    it('Cannot update not found item given id', async () => {
      jest.spyOn(itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        folderService.patch(app.db, MOCK_MEMBER, v4(), { name: 'name' }),
      ).rejects.toThrow();
    });
  });
});
