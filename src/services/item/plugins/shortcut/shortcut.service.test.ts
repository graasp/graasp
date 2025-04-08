import i18next from 'i18next';
import { v4 } from 'uuid';

import { FolderItemFactory, ItemType } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app';
import { client, db } from '../../../../drizzle/db';
import { Item, ItemWithCreator } from '../../../../drizzle/types';
import { MinimalMember } from '../../../../types';
import { AuthorizationService } from '../../../authorization';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { ItemWrapperService } from '../../ItemWrapper';
import { BasicItemService } from '../../basic.service';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { RecycledBinService } from '../recycled/recycled.service';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
import { ShortcutItemService } from './shortcut.service';

const basicItemService = {
  get: jest.fn(),
} as unknown as BasicItemService;

const shortcutService = new ShortcutItemService(
  basicItemService,
  {} as unknown as ThumbnailService,
  {} as unknown as ItemThumbnailService,
  {} as unknown as ItemMembershipRepository,
  {} as MeiliSearchWrapper,
  {} as unknown as ItemRepository,
  {} as unknown as ItemPublishedRepository,
  {} as unknown as ItemGeolocationRepository,
  {} as unknown as AuthorizationService,
  {} as unknown as ItemWrapperService,
  {} as unknown as ItemVisibilityRepository,
  {} as unknown as RecycledBinService,
  MOCK_LOGGER,
);
const id = v4();
const MOCK_ITEM = { id, type: ItemType.SHORTCUT } as Item;

const MOCK_MEMBER = { lang: 'en' } as MinimalMember;
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
      jest
        .spyOn(basicItemService, 'get')
        .mockImplementation(async (_db, _actor, id, _permission) => {
          return { id } as ItemWithCreator;
        });

      const target = v4();
      await shortcutService.postWithOptions(db, MOCK_MEMBER, {
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
      const targetItem = FolderItemFactory({ id }) as ItemWithCreator;
      jest.spyOn(BasicItemService.prototype, 'get').mockImplementation(async () => {
        return targetItem;
      });

      await shortcutService.postWithOptions(db, MOCK_MEMBER, {
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
      jest.spyOn(BasicItemService.prototype, 'get').mockRejectedValue(new Error());

      await expect(() =>
        shortcutService.postWithOptions(db, MOCK_MEMBER, {
          target: v4(),
          item: { name: 'name', description: 'description' },
        }),
      ).rejects.toThrow();
    });
  });
  describe('patch', () => {
    it('throw if item is not a shortcut', async () => {
      await expect(() =>
        shortcutService.patch(db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' }),
      ).rejects.toThrow();
    });
    it('use item service patch', async () => {
      const itemServicePatchMock = jest
        .spyOn(ItemService.prototype, 'patch')
        .mockImplementation(async () => {
          return MOCK_ITEM;
        });

      await shortcutService.patch(db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' });

      expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, MOCK_ITEM.id, {
        name: 'name',
      });
    });

    it('Cannot update not found item given id', async () => {
      jest.spyOn(itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        shortcutService.patch(db, MOCK_MEMBER, v4(), { name: 'name' }),
      ).rejects.toThrow();
    });
  });
});
