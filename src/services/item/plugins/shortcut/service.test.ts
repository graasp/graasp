import i18next from 'i18next';
import { v4 } from 'uuid';

import { FolderItemFactory, ItemType } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app.js';
import { Item } from '../../../../drizzle/types.js';
import { MinimalMember } from '../../../../types.js';
import { ThumbnailService } from '../../../thumbnail/service.js';
import { ItemRepository } from '../../repository.js';
import { ItemService } from '../../service.js';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch.js';
import { ItemThumbnailService } from '../thumbnail/service.js';
import { ShortcutItemService } from './service.js';

const shortcutService = new ShortcutItemService(
  {} as unknown as ThumbnailService,
  {} as unknown as ItemThumbnailService,
  {} as MeiliSearchWrapper,
  MOCK_LOGGER,
);
const id = v4();
const MOCK_ITEM = { id, type: ItemType.SHORTCUT } as Item;

const MOCK_MEMBER = { extra: { lang: 'en' } } as MinimalMember;
const itemRepository = {
  getOneOrThrow: async () => {
    return MOCK_ITEM;
  },
} as unknown as ItemRepository;

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
      await shortcutService.postWithOptions(app.db, MOCK_MEMBER, {
        target,
        item: { name: 'name', description: 'description' },
      });

      expect(itemServicePostMock).toHaveBeenCalledWith(MOCK_MEMBER, {
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

      await shortcutService.postWithOptions(app.db, MOCK_MEMBER, {
        target: targetItem.id,
        item: {},
      });

      expect(itemServicePostMock).toHaveBeenCalledWith(MOCK_MEMBER, {
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
        shortcutService.postWithOptions(app.db, MOCK_MEMBER, {
          target: v4(),
          item: { name: 'name', description: 'description' },
        }),
      ).rejects.toThrow();
    });
  });
  describe('patch', () => {
    it('throw if item is not a shortcut', async () => {
      await expect(() =>
        shortcutService.patch(app.db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' }),
      ).rejects.toThrow();
    });
    it('use item service patch', async () => {
      const itemServicePatchMock = jest
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      await shortcutService.patch(app.db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' });

      expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, MOCK_ITEM.id, {
        name: 'name',
      });
    });

    it('Cannot update not found item given id', async () => {
      jest.spyOn(itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        shortcutService.patch(app.db, MOCK_MEMBER, v4(), { name: 'name' }),
      ).rejects.toThrow();
    });
  });
});
