import i18next from 'i18next';
import { v4 } from 'uuid';

import { FolderItemFactory, ItemType } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app';
import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { ThumbnailService } from '../../../thumbnail/service';
import { Item } from '../../entities/Item';
import { ItemRepository } from '../../repository';
import { ItemService } from '../../service';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/service';
import { ShortcutItemService } from './service';

const shortcutService = new ShortcutItemService(
  {} as unknown as ThumbnailService,
  {} as unknown as ItemThumbnailService,
  {} as MeiliSearchWrapper,
  MOCK_LOGGER,
);
const id = v4();
const MOCK_ITEM = { id, type: ItemType.SHORTCUT } as Item;

const MOCK_MEMBER = { extra: { lang: 'en' } } as Member;
const repositories = {
  itemRepository: {
    getOneOrThrow: async () => {
      return MOCK_ITEM;
    },
  } as unknown as ItemRepository,
} as Repositories;

describe('Shortcut Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('postWithOptions', () => {
    it('set correct type and extra', async () => {
      const itemServicePostMock = jest
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as Item;
        });
      jest.spyOn(ItemService.prototype, 'get').mockImplementation(async (_m, _r, id) => {
        return { id } as Item;
      });

      const target = v4();
      await shortcutService.postWithOptions(MOCK_MEMBER, repositories, {
        target,
        item: { name: 'name', description: 'description' },
      });

      expect(itemServicePostMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, {
        item: {
          name: 'name',
          description: 'description',
          extra: { [ItemType.SHORTCUT]: { target } },
          type: ItemType.SHORTCUT,
        },
      });
    });
    it('generate default name', async () => {
      const itemServicePostMock = jest
        .spyOn(ItemService.prototype, 'post')
        .mockImplementation(async () => {
          return {} as Item;
        });
      const targetItem = FolderItemFactory({ id }) as unknown as Item;
      jest.spyOn(ItemService.prototype, 'get').mockImplementation(async () => {
        return targetItem;
      });

      await shortcutService.postWithOptions(MOCK_MEMBER, repositories, {
        target: targetItem.id,
        item: {},
      });

      expect(itemServicePostMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, {
        item: {
          // eslint-disable-next-line import/no-named-as-default-member
          name: i18next.t('DEFAULT_SHORTCUT_NAME', {
            name: targetItem.name,
            lng: MOCK_MEMBER.lang,
          }),
          description: undefined,
          extra: { [ItemType.SHORTCUT]: { target: targetItem.id } },
          type: ItemType.SHORTCUT,
        },
      });
    });
    it('throw if target does not exist', async () => {
      jest.spyOn(ItemService.prototype, 'get').mockRejectedValue(new Error());

      await expect(() =>
        shortcutService.postWithOptions(MOCK_MEMBER, repositories, {
          target: v4(),
          item: { name: 'name', description: 'description' },
        }),
      ).rejects.toThrow();
    });
  });
  describe('patch', () => {
    it('throw if item is not a shortcut', async () => {
      await expect(() =>
        shortcutService.patch(MOCK_MEMBER, repositories, MOCK_ITEM.id, { name: 'name' }),
      ).rejects.toThrow();
    });
    it('use item service patch', async () => {
      const itemServicePatchMock = jest
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      await shortcutService.patch(MOCK_MEMBER, repositories, MOCK_ITEM.id, { name: 'name' });

      expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, repositories, MOCK_ITEM.id, {
        name: 'name',
      });
    });

    it('Cannot update not found item given id', async () => {
      jest.spyOn(repositories.itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        shortcutService.patch(MOCK_MEMBER, repositories, v4(), { name: 'name' }),
      ).rejects.toThrow();
    });
  });
});
