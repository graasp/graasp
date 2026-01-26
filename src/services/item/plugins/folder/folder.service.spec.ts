import { v4 } from 'uuid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppItemFactory } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app.vitest';
import { ItemFactory } from '../../../../../test/factories/item.factory';
import { db } from '../../../../drizzle/db';
import type { ItemWithCreator } from '../../../../drizzle/types';
import type { MinimalMember } from '../../../../types';
import { ItemNotFound } from '../../../../utils/errors';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { ItemWrapperService } from '../../ItemWrapper';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../item.repository';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { RecycledBinService } from '../recycled/recycled.service';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
import { FolderItemService } from './folder.service';

const itemRepository = {
  getOneOrThrow: vi.fn(async () => {
    return MOCK_ITEM;
  }),
};
const authorizedItemService = {
  getItemById: vi.fn(),
};
const folderService = new FolderItemService(
  {} as ThumbnailService,
  {} as ItemThumbnailService,
  {} as ItemMembershipRepository,
  {} as MeiliSearchWrapper,
  itemRepository as unknown as ItemRepository,
  {} as ItemPublishedRepository,
  {} as ItemGeolocationRepository,
  authorizedItemService as unknown as AuthorizedItemService,
  {} as ItemWrapperService,
  {} as ItemVisibilityRepository,
  {} as RecycledBinService,
  MOCK_LOGGER,
);
const MOCK_ITEM = ItemFactory();

const MOCK_MEMBER = {} as MinimalMember;

describe('Folder Service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  // afterEach(() => {
  //   // vi.clearAllMocks();
  // });

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
    //   const permission = "write";
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
      authorizedItemService.getItemById.mockImplementation(async () => {
        return appItem;
      });

      await expect(() => folderService.getFolder(db, MOCK_MEMBER, appItem.id)).rejects.toThrow(
        new WrongItemTypeError('app'),
      );
    });
  });

  // describe('post', () => {
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
  // });

  describe('patch', () => {
    it('throw if item is not a folder', async () => {
      const appItem = AppItemFactory() as ItemWithCreator;
      itemRepository.getOneOrThrow.mockImplementation(async () => {
        return appItem;
      });
      await expect(() =>
        folderService.patch(db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' }),
      ).rejects.toThrow(new WrongItemTypeError('app'));
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
      const id = v4();
      itemRepository.getOneOrThrow.mockImplementation(() => {
        throw new ItemNotFound(id);
      });

      await expect(() =>
        folderService.patch(db, MOCK_MEMBER, id, { name: 'name' }),
      ).rejects.toThrow(new ItemNotFound(id));
    });
  });
});
