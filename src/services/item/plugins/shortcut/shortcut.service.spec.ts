import { v4 } from 'uuid';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ItemType } from '@graasp/sdk';

import { MOCK_LOGGER } from '../../../../../test/app.vitest';
import { ItemFactory } from '../../../../../test/factories/item.factory';
import { MemberFactory } from '../../../../../test/factories/member.factory';
import { db } from '../../../../drizzle/db';
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
import { ShortcutItemService } from './shortcut.service';

const MOCK_ITEM = ItemFactory({ type: ItemType.SHORTCUT });
const MOCK_MEMBER = MemberFactory({ extra: { lang: 'en' } });

const itemRepository = {
  getOneOrThrow: async () => {
    return MOCK_ITEM;
  },
} as unknown as ItemRepository;

const shortcutService = new ShortcutItemService(
  {} as unknown as ThumbnailService,
  {} as unknown as ItemThumbnailService,
  {} as unknown as ItemMembershipRepository,
  {} as MeiliSearchWrapper,
  itemRepository,
  {} as unknown as ItemPublishedRepository,
  {} as unknown as ItemGeolocationRepository,
  {} as unknown as AuthorizedItemService,
  {} as unknown as ItemWrapperService,
  {} as unknown as ItemVisibilityRepository,
  {} as unknown as RecycledBinService,
  MOCK_LOGGER,
);

describe('Shortcut Service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('postWithOptions', () => {
    // it('set correct type and extra', async () => {
    //   const itemServicePostMock = jest
    //     .spyOn(ItemService.prototype, 'post')
    //     .mockImplementation(async () => {
    //       return {} as Item;
    //     });
    //   // jest
    //   //   .spyOn(basicItemService, 'get')
    //   //   .mockImplementation(async (_db, _actor, id, _permission) => {
    //   //     return { id } as ItemWithCreator;
    //   //   });

    //   const targetItem = ItemFactory() as ItemWithCreator;
    //   await shortcutService.postWithOptions(db, MOCK_MEMBER, {
    //     target: targetItem.id,
    //     item: { name: 'name', description: 'description' },
    //   });

    //   // expect(itemServicePostMock).toHaveBeenCalledWith(MOCK_MEMBER, {
    //   //   item: {
    //   //     name: 'name',
    //   //     description: 'description',
    //   //     extra: { [ItemType.SHORTCUT]: { target: targetItem.id } },
    //   //     type: ItemType.SHORTCUT,
    //   //   },
    //   // });
    // });
    // it('generate default name', async () => {
    //   const itemServicePostMock = jest
    //     .spyOn(ItemService.prototype, 'post')
    //     .mockImplementation(async () => {
    //       return {} as Item;
    //     });
    //   const targetItem = ItemFactory() as ItemWithCreator;
    //   // jest.spyOn(basicItemService, 'get').mockImplementation(async () => {
    //   //   return targetItem;
    //   // });

    //   await shortcutService.postWithOptions(db, MOCK_MEMBER, {
    //     target: targetItem.id,
    //     item: {},
    //   });

    //   expect(itemServicePostMock).toHaveBeenCalledWith();
    //   expect(itemServicePostMock).toHaveBeenCalledWith(MOCK_MEMBER, {
    //     // item: {
    //     // eslint-disable-next-line import/no-named-as-default-member
    //     // name: i18next.t('DEFAULT_SHORTCUT_NAME', {
    //     //   name: targetItem.name,
    //     //   lng: MOCK_MEMBER.lang,
    //     // }),
    //     // description: undefined,
    //     // extra: { [ItemType.SHORTCUT]: { target: targetItem.id } },
    //     // type: ItemType.SHORTCUT,
    //     // },
    //   });
    // });
    it('throw if target does not exist', async () => {
      vi.spyOn(AuthorizedItemService.prototype, 'getItemById').mockRejectedValue(new Error());

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
    // it('use item service patch', async () => {
    //   const itemServicePatchMock = jest
    //     .spyOn(ItemService.prototype, 'patch')
    //     .mockImplementation(async () => {
    //       return MOCK_ITEM;
    //     });

    //   await shortcutService.patch(db, MOCK_MEMBER, MOCK_ITEM.id, { name: 'name' });

    //   expect(itemServicePatchMock).toHaveBeenCalledWith(MOCK_MEMBER, MOCK_ITEM.id, {
    //     name: 'name',
    //   });
    // });

    it('Cannot update not found item given id', async () => {
      vi.spyOn(itemRepository, 'getOneOrThrow').mockImplementation(() => {
        throw new Error();
      });

      await expect(() =>
        shortcutService.patch(db, MOCK_MEMBER, v4(), { name: 'name' }),
      ).rejects.toThrow();
    });
  });
});
