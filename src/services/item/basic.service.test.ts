import { v4 } from 'uuid';

import { MOCK_LOGGER } from '../../../test/app';
import { ItemFactory } from '../../../test/factories/item.factory';
import { MemberFactory } from '../../../test/factories/member.factory';
import { db } from '../../drizzle/db';
import { AuthorizedItemService } from '../authorizedItem.service';
import { ItemMembershipRepository } from '../itemMembership/membership.repository';
import { BasicItemService } from './basic.service';
import { ItemRepository } from './item.repository';
import { ItemVisibilityRepository } from './plugins/itemVisibility/itemVisibility.repository';

const itemRepository = new ItemRepository();
const authorizedItemService = new AuthorizedItemService(
  new ItemMembershipRepository(),
  new ItemVisibilityRepository(),
  new ItemRepository(),
);

const itemService = new BasicItemService(itemRepository, authorizedItemService, MOCK_LOGGER);

describe('Item Service', () => {
  afterEach(async () => {
    jest.clearAllMocks();
    jest.resetAllMocks();
  });

  describe('get', () => {
    it('return item if exists and pass validation', async () => {
      const item = ItemFactory();
      const actor = MemberFactory();

      jest.spyOn(itemRepository, 'getOneOrThrow').mockResolvedValue({ ...item, creator: null });
      jest
        .spyOn(authorizedItemService, 'validatePermission')
        .mockResolvedValue({ itemMembership: null, visibilities: [] });

      const result = await itemService.get(db, actor, item.id);
      expect(result).toEqual(item);
    });
    it('throw if item does not exists', async () => {
      const actor = MemberFactory();

      jest.spyOn(itemRepository, 'getOneOrThrow').mockRejectedValue(new Error());

      await expect(() => itemService.get(db, actor, v4())).rejects.toThrow();
    });
    it('throw if validation does not pass', async () => {
      const actor = MemberFactory();
      const item = ItemFactory();

      jest.spyOn(itemRepository, 'getOneOrThrow').mockResolvedValue(item);
      jest.spyOn(authorizedItemService, 'validatePermission').mockRejectedValue(new Error());

      await expect(() => itemService.get(db, actor, item.id)).rejects.toThrow();
    });
  });
});
