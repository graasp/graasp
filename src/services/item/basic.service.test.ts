import { v4 } from 'uuid';

import { MOCK_LOGGER } from '../../../test/app';
import { ItemFactory } from '../../../test/factories/item.factory';
import { MemberFactory } from '../../../test/factories/member.factory';
import { db } from '../../drizzle/db';
import { AuthorizationService } from '../authorization';
import { ItemMembershipRepository } from '../itemMembership/repository';
import { BasicItemService } from './basic.service';
import { ItemVisibilityRepository } from './plugins/itemVisibility/repository';
import { ItemRepository } from './repository';

const itemRepository = new ItemRepository();
const authorizationService = new AuthorizationService(
  new ItemMembershipRepository(),
  new ItemVisibilityRepository(),
);

const itemService = new BasicItemService(itemRepository, authorizationService, MOCK_LOGGER);

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
        .spyOn(authorizationService, 'validatePermission')
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
      jest.spyOn(authorizationService, 'validatePermission').mockRejectedValue(new Error());

      await expect(() => itemService.get(db, actor, item.id)).rejects.toThrow();
    });
  });
});
