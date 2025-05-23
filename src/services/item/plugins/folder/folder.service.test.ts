import { v4 } from 'uuid';

import { AppItemFactory } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app';
import { ItemFactory } from '../../../../../test/factories/item.factory';
import { db } from '../../../../drizzle/db';
import { ItemWithCreator } from '../../../../drizzle/types';
import { MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { ItemWrapperService } from '../../ItemWrapper';
import { ItemRepository } from '../../item.repository';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { RecycledBinService } from '../recycled/recycled.service';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
import { FolderItemService } from './folder.service';

const folderService = new FolderItemService(
  {} as ThumbnailService,
  {} as ItemThumbnailService,
  {} as ItemMembershipRepository,
  {} as MeiliSearchWrapper,
  {} as ItemRepository,
  {} as ItemPublishedRepository,
  {} as ItemGeolocationRepository,
  {} as AuthorizedItemService,
  {} as ItemWrapperService,
  {} as ItemVisibilityRepository,
  {} as RecycledBinService,
  MOCK_LOGGER,
);
const MOCK_ITEM = ItemFactory();

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
    // it('return folder', async () => {
    //   const folderItem = FolderItemFactory() as ItemWithCreator;
    //   const itemServicePostMock = jest
    //     .spyOn(BasicItemService.prototype, 'get')
    //     .mockImplementation(async () => {
    //       return folderItem;
    //     });

    //   expect(await folderService.getFolder(db, MOCK_MEMBER, folderItem.id)).toEqual(folderItem);

    //   expect(itemServicePostMock).toHaveBeenCalledWith(
    //     db,
    //     MOCK_MEMBER,

    //     folderItem.id,
    //     undefined,
    //   );
    // });

    // it('return folder for permission', async () => {
    //   const permission = PermissionLevel.Write;
    //   const folderItem = FolderItemFactory() as ItemWithCreator;
    //   const itemServicePostMock = jest
    //     .spyOn(BasicItemService.prototype, 'get')
    //     .mockImplementation(async () => {
    //       return folderItem;
    //     });

    //   expect(await folderService.getFolder(db, MOCK_MEMBER, folderItem.id, permission)).toEqual(
    //     folderItem,
    //   );

    //   expect(itemServicePostMock).toHaveBeenCalledWith(
    //     db,
    //     MOCK_MEMBER,

    //     folderItem.id,
    //     permission,
    //   );
    // });

    it('throw if item is not a folder', async () => {
      const appItem = AppItemFactory() as ItemWithCreator;
      jest.spyOn(AuthorizedItemService.prototype, 'getItemById').mockImplementation(async () => {
        return appItem;
      });

      await expect(() => folderService.getFolder(db, MOCK_MEMBER, appItem.id)).rejects.toThrow();
    });
  });

  describe('post', () => {
    // it('set correct type and extra', async () => {
    //   const itemServicePostMock = jest
    //     .spyOn(ItemService.prototype, 'post')
    //     .mockImplementation(async () => {
    //       return {} as Item;
    //     });
    //   await folderService.post(db, MOCK_MEMBER, { item: { name: 'name', type: 'folder' } });
    //   expect(itemServicePostMock).toHaveBeenCalledWith(db, MOCK_MEMBER, {
    //     item: { name: 'name', extra: { [ItemType.FOLDER]: {} }, type: ItemType.FOLDER },
    //   });
    // });
  });
  describe('patch', () => {
    it('throw if item is not a folder', async () => {
      await expect(() =>
        folderService.patch(db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' }),
      ).rejects.toThrow();
    });
    // it('use item service patch', async () => {
    //   const itemServicePatchMock = jest
    //     .spyOn(ItemService.prototype, 'patch')
    //     .mockImplementation(async () => {
    //       return MOCK_ITEM;
    //     });

    //   await folderService.patch(db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' });

    //   expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, MOCK_ITEM.id, {
    //     name: 'name',
    //   });
    // });

    it('Cannot update not found item given id', async () => {
      jest.spyOn(itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        folderService.patch(db, MOCK_MEMBER, v4(), { name: 'name' }),
      ).rejects.toThrow();
    });
  });
});
