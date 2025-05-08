import { ItemVisibilityType, PermissionLevel, PermissionLevelOptions } from '@graasp/sdk';

import { ItemFactory } from '../../test/factories/item.factory';
import { ItemVisibilityFactory } from '../../test/factories/itemVisibility.factory';
import { DBConnection } from '../drizzle/db';
import { ItemMembershipWithItemAndAccount, ItemRaw } from '../drizzle/types';
import { MinimalMember } from '../types';
import { MemberCannotAccess, MemberCannotAdminItem, MemberCannotWriteItem } from '../utils/errors';
import { AuthorizedItemService } from './authorizedItem.service';
import { ItemRepository } from './item/item.repository';
import { ItemVisibilityRepository } from './item/plugins/itemVisibility/itemVisibility.repository';
import { ItemMembershipRepository } from './itemMembership/membership.repository';

const MOCK_DB = {} as unknown as DBConnection;

const OWNER = { id: 'owner', name: 'owner' } as MinimalMember;
const SHARED_MEMBER = { id: 'shared', name: 'shared' };
const OTHER_MEMBER = { id: 'other', name: 'other' };
const ITEM = ItemFactory({ id: 'item' });

const ownerMembership = {
  account: OWNER,
  permission: PermissionLevel.Admin,
  item: ITEM,
} as unknown as ItemMembershipWithItemAndAccount;

const buildSharedMembership = (permission: PermissionLevelOptions, item: ItemRaw = ITEM) =>
  ({ account: SHARED_MEMBER, permission, item }) as ItemMembershipWithItemAndAccount;

const itemMembershipRepository = new ItemMembershipRepository();
const itemVisibilityRepository = new ItemVisibilityRepository();
const itemRepository = new ItemRepository();

const authorizationService = new AuthorizedItemService(
  itemMembershipRepository,
  itemVisibilityRepository,
  itemRepository,
);

describe('assertPermissionMany for one item', () => {
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
      authorizationService.getManyItemsWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        items: [ITEM],
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  describe('Private item', () => {
    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [] },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });
    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships } = await authorizationService.getManyItemsWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        items: [ITEM],
      });
      expect(itemMemberships.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Shared item with Read permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Read);

    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [] },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;
            case SHARED_MEMBER.id:
              im = sharedMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member should pass
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotWriteItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Shared item with Write permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write);

    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [] },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;
            case SHARED_MEMBER.id:
              im = sharedMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member should pass
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member should pass
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Shared item with Admin permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Admin);

    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [] },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;
            case SHARED_MEMBER.id:
              im = sharedMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can write
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can admin
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item', () => {
    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM })],
        },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // other member can read
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item with shared read permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Read);
    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM })],
        },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;
            case SHARED_MEMBER.id:
              im = sharedMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member can read
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.data[ITEM.id]).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't write
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotWriteItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't admin
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item with shared write permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write);

    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM })],
        },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;
            case SHARED_MEMBER.id:
              im = sharedMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member can read
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.data[ITEM.id]).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't write
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't admin
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item with shared admin permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Admin);

    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM })],
        },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;
            case SHARED_MEMBER.id:
              im = sharedMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member can read
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.data[ITEM.id]).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't write
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't admin
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Hidden item with shared read permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Read);

    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM })],
        },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;
            case SHARED_MEMBER.id:
              im = sharedMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot read
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Hidden item with shared with write permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write);

    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM })],
        },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;
            case SHARED_MEMBER.id:
              im = sharedMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Hidden item with shared with admin permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Admin);

    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM })],
        },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;
            case SHARED_MEMBER.id:
              im = sharedMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public & Hidden item', () => {
    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [
            ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
            ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
          ],
        },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;
            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public & Hidden item with shared read permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Read);

    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [
            ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
            ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
          ],
        },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;
            case SHARED_MEMBER.id:
              im = sharedMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public & Hidden item with shared write permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write);

    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [
            ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
            ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
          ],
        },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;
            case SHARED_MEMBER.id:
              im = sharedMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public & Hidden item with shared admin permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Admin);

    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: {
          [ITEM.id]: [
            ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
            ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
          ],
        },
        errors: [],
      });

      jest
        .spyOn(itemMembershipRepository, 'getInheritedMany')
        .mockImplementation(async (_db, _items, memberId) => {
          let im;

          switch (memberId) {
            case OWNER.id:
              im = ownerMembership;
              break;
            case SHARED_MEMBER.id:
              im = sharedMembership;
              break;

            default:
              break;
          }
          return { data: { [ITEM.id]: im }, errors: [] };
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it('PermissionLevel.Admin', async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OWNER, items: [ITEM] },
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, items: [ITEM] },
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: OTHER_MEMBER, items: [ITEM] },
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });
});

describe('assertPermissionMany for many items', () => {
  const SHARED_ITEM = ItemFactory({ id: 'shared-item' });
  const PUBLIC_ITEM = ItemFactory({ id: 'public-item' });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Public item & Shared write item', async () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write, SHARED_ITEM);
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
    const { itemMemberships: result } = await authorizationService.getManyItemsWithProperties(
      MOCK_DB,
      { permission: PermissionLevel.Read, actor: SHARED_MEMBER, items: [SHARED_ITEM, PUBLIC_ITEM] },
    );
    expect(result.data[SHARED_ITEM.id]).toEqual(sharedMembership);
    expect(result.data[PUBLIC_ITEM.id]).toEqual(null);

    // shared member cannot write public item
    const { itemMemberships: result1 } = await authorizationService.getManyItemsWithProperties(
      MOCK_DB,
      {
        permission: PermissionLevel.Write,
        actor: SHARED_MEMBER,
        items: [SHARED_ITEM, PUBLIC_ITEM],
      },
    );
    expect(result1.data[SHARED_ITEM.id]).toEqual(sharedMembership);
    expect(result1.data[PUBLIC_ITEM.id]).toBeUndefined();
    expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

    // shared member cannot admin
    const { itemMemberships: result2 } = await authorizationService.getManyItemsWithProperties(
      MOCK_DB,
      {
        permission: PermissionLevel.Admin,
        actor: SHARED_MEMBER,
        items: [SHARED_ITEM, PUBLIC_ITEM],
      },
    );
    expect(result2.errors[0]).toBeInstanceOf(MemberCannotAdminItem);
    expect(result2.data[PUBLIC_ITEM.id]).toBeUndefined();
    expect(result2.errors[1]).toBeInstanceOf(MemberCannotAccess);
  });
});

describe('assertPermissionMany for no items', () => {
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

    const res = await authorizationService.getManyItemsWithProperties(MOCK_DB, {
      permission: PermissionLevel.Admin,
      actor: OWNER,
      items: [],
    });
    const expected: Awaited<ReturnType<typeof authorizationService.getManyItemsWithProperties>> = {
      itemMemberships: { data: {}, errors: [] },
      visibilities: { data: {}, errors: [] },
      items: [ITEM],
    };
    // any other member shouldn't access
    expect(res).toEqual(expected);
    expect(itemMembershipRepository.getInheritedMany).not.toHaveBeenCalled();
    expect(itemVisibilityRepository.getManyForMany).not.toHaveBeenCalled();
  });
});
