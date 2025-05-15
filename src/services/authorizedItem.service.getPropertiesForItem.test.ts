import { ItemVisibilityType, PermissionLevel, PermissionLevelOptions } from '@graasp/sdk';

import { ItemFactory } from '../../test/factories/item.factory';
import { ItemVisibilityFactory } from '../../test/factories/itemVisibility.factory';
import { DBConnection } from '../drizzle/db';
import { ItemMembershipWithItemAndAccount, ItemRaw } from '../drizzle/types';
import { MemberCannotAccess, MemberCannotAdminItem, MemberCannotWriteItem } from '../utils/errors';
import { AuthorizedItemService } from './authorizedItem.service';
import { ItemRepository } from './item/item.repository';
import { ItemVisibilityRepository } from './item/plugins/itemVisibility/itemVisibility.repository';
import { ItemMembershipRepository } from './itemMembership/membership.repository';

const MOCK_DB = {} as unknown as DBConnection;

const MEMBER = { id: 'shared', name: 'shared' };
const ITEM = ItemFactory({ id: 'item' });

const buildSharedMembership = (permission: PermissionLevelOptions, item: ItemRaw = ITEM) =>
  ({ account: MEMBER, permission, item }) as ItemMembershipWithItemAndAccount;

const adminMembership = buildSharedMembership(PermissionLevel.Admin);
const writeMembership = buildSharedMembership(PermissionLevel.Write);
const readMembership = buildSharedMembership(PermissionLevel.Read);

const itemMembershipRepository = new ItemMembershipRepository();
const itemVisibilityRepository = new ItemVisibilityRepository();
const itemRepository = new ItemRepository();

const authorizationService = new AuthorizedItemService(
  itemMembershipRepository,
  itemVisibilityRepository,
  itemRepository,
);

describe('getPropertiesForItem', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('Invalid saved membership', async () => {
    jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);

    jest
      .spyOn(itemMembershipRepository, 'getInherited')
      .mockImplementation(
        async () => ({ permission: 'anything' }) as unknown as ItemMembershipWithItemAndAccount,
      );

    // any other member shouldn't access
    await expect(
      authorizationService.getPropertiesForItem(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: MEMBER,
        item: ITEM,
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it.each([
    // no membership
    {
      permission: PermissionLevel.Read,
      membership: null,
      rejects: MemberCannotAccess,
    },
    {
      permission: PermissionLevel.Write,
      membership: null,
      rejects: MemberCannotAccess,
    },
    {
      permission: PermissionLevel.Admin,
      membership: null,
      rejects: MemberCannotAccess,
    },
    // shared item with read permission
    {
      permission: PermissionLevel.Read,
      membership: readMembership,
      returns: readMembership,
    },
    {
      permission: PermissionLevel.Write,
      membership: readMembership,
      rejects: MemberCannotWriteItem,
    },
    {
      permission: PermissionLevel.Admin,
      membership: readMembership,
      rejects: MemberCannotAdminItem,
    },
    // shared item with write permission
    {
      permission: PermissionLevel.Read,
      membership: writeMembership,
      returns: writeMembership,
    },
    {
      permission: PermissionLevel.Write,
      membership: writeMembership,
      returns: writeMembership,
    },
    {
      permission: PermissionLevel.Admin,
      membership: writeMembership,
      rejects: MemberCannotAdminItem,
    },
    // shared item with admin permission
    {
      permission: PermissionLevel.Read,
      membership: adminMembership,
      returns: adminMembership,
    },
    {
      permission: PermissionLevel.Write,
      membership: adminMembership,
      returns: adminMembership,
    },
    {
      permission: PermissionLevel.Admin,
      membership: adminMembership,
      returns: adminMembership,
    },
  ])(
    'request $permission for private item',
    async ({ permission, membership, returns, rejects }) => {
      jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async () => membership);

      await authorizationService
        .getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        })
        .then(({ itemMembership: result }) => {
          if (rejects) {
            throw new Error('should throw');
          }
          expect(result).toEqual(returns);
        })
        .catch((e) => {
          if (returns) {
            throw new Error('should return');
          }
          expect(e).toBeInstanceOf(rejects);
        });
    },
  );

  it.each([
    // no membership
    {
      permission: PermissionLevel.Read,
      membership: null,
      returns: null,
    },
    {
      permission: PermissionLevel.Write,
      membership: null,
      rejects: MemberCannotAccess,
    },
    {
      permission: PermissionLevel.Admin,
      membership: null,
      rejects: MemberCannotAccess,
    },
    // shared item with read permission
    {
      permission: PermissionLevel.Read,
      membership: readMembership,
      returns: readMembership,
    },
    {
      permission: PermissionLevel.Write,
      membership: readMembership,
      rejects: MemberCannotWriteItem,
    },
    {
      permission: PermissionLevel.Admin,
      membership: readMembership,
      rejects: MemberCannotAdminItem,
    },
    // shared item with write permission
    {
      permission: PermissionLevel.Read,
      membership: writeMembership,
      returns: writeMembership,
    },
    {
      permission: PermissionLevel.Write,
      membership: writeMembership,
      returns: writeMembership,
    },
    {
      permission: PermissionLevel.Admin,
      membership: writeMembership,
      rejects: MemberCannotAdminItem,
    },
    // shared item with admin permission
    {
      permission: PermissionLevel.Read,
      membership: adminMembership,
      returns: adminMembership,
    },
    {
      permission: PermissionLevel.Write,
      membership: adminMembership,
      returns: adminMembership,
    },
    {
      permission: PermissionLevel.Admin,
      membership: adminMembership,
      returns: adminMembership,
    },
  ])('Public item: $permission', async ({ permission, membership, returns, rejects }) => {
    jest
      .spyOn(itemVisibilityRepository, 'getByItemPath')
      .mockImplementation(async () => [
        ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
      ]);
    jest.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(async () => membership);

    await authorizationService
      .getPropertiesForItem(MOCK_DB, {
        permission,
        actor: MEMBER,
        item: ITEM,
      })
      .then(({ itemMembership: result }) => {
        if (rejects) {
          throw new Error('should throw');
        }
        expect(result).toEqual(returns);
      })
      .catch((e) => {
        if (returns) {
          throw new Error('should return');
        }
        expect(e).toBeInstanceOf(rejects);
      });
  });

  it.each([
    // no membership
    {
      permission: PermissionLevel.Read,
      membership: null,
      rejects: MemberCannotAccess,
    },
    {
      permission: PermissionLevel.Write,
      membership: null,
      rejects: MemberCannotAccess,
    },
    {
      permission: PermissionLevel.Admin,
      membership: null,
      rejects: MemberCannotAccess,
    },
    // shared item with read permission
    {
      permission: PermissionLevel.Read,
      membership: readMembership,
      rejects: MemberCannotAccess,
    },
    {
      permission: PermissionLevel.Write,
      membership: readMembership,
      rejects: MemberCannotAccess,
    },
    {
      permission: PermissionLevel.Admin,
      membership: readMembership,
      rejects: MemberCannotAccess,
    },
    // shared item with write permission
    {
      permission: PermissionLevel.Read,
      membership: writeMembership,
      returns: writeMembership,
    },
    {
      permission: PermissionLevel.Write,
      membership: writeMembership,
      returns: writeMembership,
    },
    {
      permission: PermissionLevel.Admin,
      membership: writeMembership,
      rejects: MemberCannotAdminItem,
    },
    // shared item with admin permission
    {
      permission: PermissionLevel.Read,
      membership: adminMembership,
      returns: adminMembership,
    },
    {
      permission: PermissionLevel.Write,
      membership: adminMembership,
      returns: adminMembership,
    },
    {
      permission: PermissionLevel.Admin,
      membership: adminMembership,
      returns: adminMembership,
    },
  ])(
    'request $permission for hidden item',
    async ({ permission, membership, returns, rejects }) => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [
          ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
        ]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async () => membership);

      await authorizationService
        .getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        })
        .then(({ itemMembership: result }) => {
          if (rejects) {
            throw new Error('should throw');
          }
          expect(result).toEqual(returns);
        })
        .catch((e) => {
          if (returns) {
            throw new Error('should return');
          }
          expect(e).toBeInstanceOf(rejects);
        });
    },
  );

  it.each([
    // no membership
    {
      permission: PermissionLevel.Read,
      membership: null,
      rejects: MemberCannotAccess,
    },
    {
      permission: PermissionLevel.Write,
      membership: null,
      rejects: MemberCannotAccess,
    },
    {
      permission: PermissionLevel.Admin,
      membership: null,
      rejects: MemberCannotAccess,
    },
    // shared item with read permission
    {
      permission: PermissionLevel.Read,
      membership: readMembership,
      rejects: MemberCannotAccess,
    },
    {
      permission: PermissionLevel.Write,
      membership: readMembership,
      rejects: MemberCannotAccess,
    },
    {
      permission: PermissionLevel.Admin,
      membership: readMembership,
      rejects: MemberCannotAccess,
    },
    // shared item with write permission
    {
      permission: PermissionLevel.Read,
      membership: writeMembership,
      returns: writeMembership,
    },
    {
      permission: PermissionLevel.Write,
      membership: writeMembership,
      returns: writeMembership,
    },
    {
      permission: PermissionLevel.Admin,
      membership: writeMembership,
      rejects: MemberCannotAdminItem,
    },
    // shared item with admin permission
    {
      permission: PermissionLevel.Read,
      membership: adminMembership,
      returns: adminMembership,
    },
    {
      permission: PermissionLevel.Write,
      membership: adminMembership,
      returns: adminMembership,
    },
    {
      permission: PermissionLevel.Admin,
      membership: adminMembership,
      returns: adminMembership,
    },
  ])(
    'request $permission for public & hidden item',
    async ({ permission, membership, returns, rejects }) => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [
          ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
          ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
        ]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async () => membership);

      await authorizationService
        .getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        })
        .then(({ itemMembership: result }) => {
          if (rejects) {
            throw new Error('should throw');
          }
          expect(result).toEqual(returns);
        })
        .catch((e) => {
          if (returns) {
            throw new Error('should return');
          }
          expect(e).toBeInstanceOf(rejects);
        });
    },
  );
});
