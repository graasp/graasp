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

describe('getPropertiesForItems for one item', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Invalid saved membership', async () => {
    jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
      data: { [ITEM.id]: [] },
      errors: [],
    });

    jest.spyOn(itemMembershipRepository, 'getInheritedMany').mockResolvedValue({
      data: {
        [ITEM.id]: { permission: 'anything' } as unknown as ItemMembershipWithItemAndAccount,
      },
      errors: [],
    });

    // any other member shouldn't access
    await expect(
      authorizationService.getPropertiesForItems(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: MEMBER,
        items: [ITEM],
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
    'request $permission access for private item',
    async ({ permission, membership, returns, rejects }) => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [] },
        errors: [],
      });

      jest.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        if (!membership) {
          return { data: {}, errors: [] };
        }
        return { data: { [ITEM.id]: membership }, errors: [] };
      });

      await authorizationService
        .getPropertiesForItems(MOCK_DB, {
          permission,
          actor: MEMBER,
          items: [ITEM],
        })
        .then(({ itemMemberships }) => {
          if (returns) {
            expect(itemMemberships.data[ITEM.id]).toEqual(returns);
          }

          if (rejects) {
            expect(itemMemberships.errors[0]).toBeInstanceOf(rejects);
          }
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
  ])(
    'request $permission access for public item',
    async ({ permission, membership, returns, rejects }) => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM })],
        },
        errors: [],
      });

      jest.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        if (!membership) {
          return { data: {}, errors: [] };
        }
        return { data: { [ITEM.id]: membership }, errors: [] };
      });

      await authorizationService
        .getPropertiesForItems(MOCK_DB, {
          permission,
          actor: MEMBER,
          items: [ITEM],
        })
        .then(({ itemMemberships }) => {
          if (returns) {
            expect(itemMemberships.data[ITEM.id]).toEqual(returns);
          }

          if (rejects) {
            expect(itemMemberships.errors[0]).toBeInstanceOf(rejects);
          }
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
    'request $permission access for hidden item',
    async ({ permission, membership, returns, rejects }) => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM })],
        },
        errors: [],
      });

      jest.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        if (!membership) {
          return { data: {}, errors: [] };
        }
        return { data: { [ITEM.id]: membership }, errors: [] };
      });

      await authorizationService
        .getPropertiesForItems(MOCK_DB, {
          permission,
          actor: MEMBER,
          items: [ITEM],
        })
        .then(({ itemMemberships }) => {
          if (returns) {
            expect(itemMemberships.data[ITEM.id]).toEqual(returns);
          }

          if (rejects) {
            expect(itemMemberships.errors[0]).toBeInstanceOf(rejects);
          }
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
    'request $permission access for hidden and public item',
    async ({ permission, membership, returns, rejects }) => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [
            ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
            ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
          ],
        },
        errors: [],
      });

      jest.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        if (!membership) {
          return { data: {}, errors: [] };
        }
        return { data: { [ITEM.id]: membership }, errors: [] };
      });

      await authorizationService
        .getPropertiesForItems(MOCK_DB, {
          permission,
          actor: MEMBER,
          items: [ITEM],
        })
        .then(({ itemMemberships }) => {
          if (returns) {
            expect(itemMemberships.data[ITEM.id]).toEqual(returns);
          }

          if (rejects) {
            expect(itemMemberships.errors[0]).toBeInstanceOf(rejects);
          }
        });
    },
  );
});

describe('getPropertiesForItems for many items', () => {
  const SHARED_MEMBER = { id: 'shared', name: 'shared' };
  const SHARED_ITEM = ItemFactory({ id: 'shared-item' });
  const PUBLIC_ITEM = ItemFactory({ id: 'public-item' });
  const sharedMembership = buildSharedMembership(PermissionLevel.Write, SHARED_ITEM);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Public item & Shared write item', async () => {
    jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockImplementation(async () => ({
      data: {
        [PUBLIC_ITEM.id]: [ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM })],
        [SHARED_ITEM.id]: [],
      },
      errors: [],
    }));

    jest
      .spyOn(itemMembershipRepository, 'getInheritedMany')
      .mockImplementation(async (_db, _items, _memberId) => ({
        data: { [SHARED_ITEM.id]: sharedMembership },
        errors: [],
      }));
    // shared member can read both items
    const { itemMemberships: result } = await authorizationService.getPropertiesForItems(MOCK_DB, {
      permission: PermissionLevel.Read,
      actor: SHARED_MEMBER,
      items: [SHARED_ITEM, PUBLIC_ITEM],
    });
    expect(result.data[SHARED_ITEM.id]).toEqual(sharedMembership);
    expect(result.data[PUBLIC_ITEM.id]).toEqual(null);

    // shared member cannot write public item
    const { itemMemberships: result1 } = await authorizationService.getPropertiesForItems(MOCK_DB, {
      permission: PermissionLevel.Write,
      actor: SHARED_MEMBER,
      items: [SHARED_ITEM, PUBLIC_ITEM],
    });
    expect(result1.data[SHARED_ITEM.id]).toEqual(sharedMembership);
    expect(result1.data[PUBLIC_ITEM.id]).toBeUndefined();
    expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

    // shared member cannot admin
    const { itemMemberships: result2 } = await authorizationService.getPropertiesForItems(MOCK_DB, {
      permission: PermissionLevel.Admin,
      actor: SHARED_MEMBER,
      items: [SHARED_ITEM, PUBLIC_ITEM],
    });
    expect(result2.errors[0]).toBeInstanceOf(MemberCannotAdminItem);
    expect(result2.data[PUBLIC_ITEM.id]).toBeUndefined();
    expect(result2.errors[1]).toBeInstanceOf(MemberCannotAccess);
  });
});

describe('getPropertiesForItems for no items', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('Should return empty data', async () => {
    jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
      data: { [ITEM.id]: [] },
      errors: [],
    });

    jest.spyOn(itemMembershipRepository, 'getInheritedMany').mockResolvedValue({
      data: {},
      errors: [],
    });

    const res = await authorizationService.getPropertiesForItems(MOCK_DB, {
      permission: PermissionLevel.Admin,
      actor: MEMBER,
      items: [],
    });
    const expected: Awaited<ReturnType<typeof authorizationService.getPropertiesForItems>> = {
      itemMemberships: { data: {}, errors: [] },
      visibilities: { data: {}, errors: [] },
    };
    // any other member shouldn't access
    expect(res).toEqual(expected);
    expect(itemMembershipRepository.getInheritedMany).not.toHaveBeenCalled();
    expect(itemVisibilityRepository.getManyForMany).not.toHaveBeenCalled();
  });
});
