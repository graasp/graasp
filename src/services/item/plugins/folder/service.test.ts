import { v4 } from 'uuid';

import { ItemType } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app';
import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { ThumbnailService } from '../../../thumbnail/service';
import { Item } from '../../entities/Item';
import { ItemRepository } from '../../repository';
import { ItemService } from '../../service';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/service';
import { FolderItemService } from './service';

const folderService = new FolderItemService(
  {} as unknown as ThumbnailService,
  {} as unknown as ItemThumbnailService,
  {} as MeiliSearchWrapper,
  MOCK_LOGGER,
);
const id = v4();
const MOCK_ITEM = { id, type: ItemType.FOLDER } as Item;

const MOCK_MEMBER = {} as Member;
const repositories = {
  itemRepository: {
    getOneOrThrow: async () => {
      return MOCK_ITEM;
    },
  } as unknown as ItemRepository,
} as Repositories;

describe('Folder Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('post', () => {
    it('set correct type and extra', async () => {
      const itemServicePostMock = jest
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as Item;
        });

      await folderService.post(MOCK_MEMBER, repositories, { item: { name: 'name' } });

      expect(itemServicePostMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, {
        item: { name: 'name', extra: { [ItemType.FOLDER]: {} }, type: ItemType.FOLDER },
      });
    });
  });
  describe('patch', () => {
    it('throw if item is not a folder', async () => {
      await expect(() =>
        folderService.patch(MOCK_MEMBER, repositories, MOCK_ITEM.id, { name: 'name' }),
      ).rejects.toThrow();
    });
    it('use item service patch', async () => {
      const itemServicePatchMock = jest
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      await folderService.patch(MOCK_MEMBER, repositories, MOCK_ITEM.id, { name: 'name' });

      expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, MOCK_ITEM.id, {
        name: 'name',
      });
    });

    it('Cannot update not found item given id', async () => {
      jest.spyOn(repositories.itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        folderService.patch(MOCK_MEMBER, repositories, v4(), { name: 'name' }),
      ).rejects.toThrow();
    });
  });
});
