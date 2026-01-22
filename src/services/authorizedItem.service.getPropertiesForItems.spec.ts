import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemVisibilityType } from '@graasp/sdk';

import { ItemFactory } from '../../test/factories/item.factory';
import { ItemVisibilityFactory } from '../../test/factories/itemVisibility.factory';
import type { DBConnection } from '../drizzle/db';
import type { ItemMembershipWithItemAndAccount, ItemRaw } from '../drizzle/types';
import { PermissionLevel } from '../types';
import { MemberCannotAccess, MemberCannotAdminItem, MemberCannotWriteItem } from '../utils/errors';
import { AuthorizedItemService } from './authorizedItem.service';
import { ItemRepository } from './item/item.repository';
import { ItemVisibilityRepository } from './item/plugins/itemVisibility/itemVisibility.repository';
import { ItemMembershipRepository } from './itemMembership/membership.repository';

const MOCK_DB = {} as unknown as DBConnection;

const MEMBER = { id: 'shared', name: 'shared' };
const ITEM = ItemFactory({ id: 'item' });

const buildSharedMembership = (permission: PermissionLevel, item: ItemRaw = ITEM) =>
  ({ account: MEMBER, permission, item }) as ItemMembershipWithItemAndAccount;

const adminMembership = buildSharedMembership('admin');
const writeMembership = buildSharedMembership('write');
const readMembership = buildSharedMembership('read');

const hiddenVisibility = ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM });
const publicVisibility = ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM });

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
    vi.restoreAllMocks();
  });

  it('Invalid saved membership', async () => {
    vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
      data: { [ITEM.id]: [] },
      errors: [],
    });

    vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockResolvedValue({
      data: {
        [ITEM.id]: { permission: 'anything' } as unknown as ItemMembershipWithItemAndAccount,
      },
      errors: [],
    });

    // any other member shouldn't access
    await expect(
      authorizationService.getPropertiesForItems(MOCK_DB, {
        permission: 'admin' as const,
        accountId: MEMBER.id,
        items: [ITEM],
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  describe('private item shared without permission', () => {
    it.each([
      { permission: 'read' as const, rejects: MemberCannotAccess },
      { permission: 'write' as const, rejects: MemberCannotAccess },
      { permission: 'admin' as const, rejects: MemberCannotAccess },
    ])('request $permission should return error', async ({ permission, rejects }) => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: {}, errors: [] };
      });
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.errors[0],
      ).toBeInstanceOf(rejects);
    });
  });

  describe('private item shared with read permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: { [ITEM.id]: readMembership }, errors: [] };
      });
    });

    it.each(['read' as const])('request %s should return', async (permission) => {
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.data[ITEM.id],
      ).toEqual(readMembership);
    });

    it.each([
      { permission: 'write' as const, rejects: MemberCannotWriteItem },
      { permission: 'admin' as const, rejects: MemberCannotAdminItem },
    ])('request $permission should return error', async ({ permission, rejects }) => {
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.errors[0],
      ).toBeInstanceOf(rejects);
    });
  });

  describe('private item shared with write permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: { [ITEM.id]: writeMembership }, errors: [] };
      });
    });
    it.each(['read', 'write'] as const)('request %s should return', async (permission) => {
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.data[ITEM.id],
      ).toEqual(writeMembership);
    });
    it.each([{ permission: 'admin' as const, rejects: MemberCannotAdminItem }])(
      'request $permission should return error',
      async ({ permission, rejects }) => {
        expect(
          (
            await authorizationService.getPropertiesForItems(MOCK_DB, {
              permission,
              accountId: MEMBER.id,
              items: [ITEM],
            })
          ).itemMemberships.errors[0],
        ).toBeInstanceOf(rejects);
      },
    );
  });

  describe('private item shared with admin permission', () => {
    it.each(['read', 'write', 'admin'] as const)('request %s should return', async (permission) => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: { [ITEM.id]: adminMembership }, errors: [] };
      });
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.data[ITEM.id],
      ).toEqual(adminMembership);
    });
  });

  describe('public item shared without permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [publicVisibility] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: {}, errors: [] };
      });
    });
    it.each(['read' as const])('request %s should return', async (permission) => {
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.data[ITEM.id],
      ).toEqual(null);
    });
    it.each([
      { permission: 'write' as const, rejects: MemberCannotAccess },
      { permission: 'admin' as const, rejects: MemberCannotAccess },
    ])('request $permission should return error', async ({ permission, rejects }) => {
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.errors[0],
      ).toBeInstanceOf(rejects);
    });
  });

  describe('public item shared with read permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [publicVisibility] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: { [ITEM.id]: readMembership }, errors: [] };
      });
    });
    it.each(['read' as const])('request %s should return', async (permission) => {
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.data[ITEM.id],
      ).toEqual(readMembership);
    });
    it.each([
      { permission: 'write' as const, rejects: MemberCannotWriteItem },
      { permission: 'admin' as const, rejects: MemberCannotAdminItem },
    ])('request $permission should return error', async ({ permission, rejects }) => {
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.errors[0],
      ).toBeInstanceOf(rejects);
    });
  });

  describe('public item shared with write permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [publicVisibility] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: { [ITEM.id]: writeMembership }, errors: [] };
      });
    });
    it.each(['read', 'write'] as const)('request %s should return', async (permission) => {
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.data[ITEM.id],
      ).toEqual(writeMembership);
    });
    it.each([{ permission: 'admin' as const, rejects: MemberCannotAdminItem }])(
      'request $permission should return error',
      async ({ permission, rejects }) => {
        expect(
          (
            await authorizationService.getPropertiesForItems(MOCK_DB, {
              permission,
              accountId: MEMBER.id,
              items: [ITEM],
            })
          ).itemMemberships.errors[0],
        ).toBeInstanceOf(rejects);
      },
    );
  });

  describe('public item shared with admin permission', () => {
    it.each(['read', 'write', 'admin'] as const)('request %s should return', async (permission) => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [publicVisibility] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: { [ITEM.id]: adminMembership }, errors: [] };
      });
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.data[ITEM.id],
      ).toEqual(adminMembership);
    });
  });

  describe('hidden item shared without permission', () => {
    it.each([
      { permission: 'read' as const, rejects: MemberCannotAccess },
      { permission: 'write' as const, rejects: MemberCannotAccess },
      { permission: 'admin' as const, rejects: MemberCannotAccess },
    ])('request $permission should return error', async ({ permission, rejects }) => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [hiddenVisibility] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: {}, errors: [] };
      });
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.errors[0],
      ).toBeInstanceOf(rejects);
    });
  });

  describe('hidden item shared with read permission', () => {
    it.each([
      { permission: 'read' as const, rejects: MemberCannotAccess },
      { permission: 'write' as const, rejects: MemberCannotAccess },
      { permission: 'admin' as const, rejects: MemberCannotAccess },
    ])('request $permission should return error', async ({ permission, rejects }) => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [hiddenVisibility] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: { [ITEM.id]: readMembership }, errors: [] };
      });
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.errors[0],
      ).toBeInstanceOf(rejects);
    });
  });

  describe('hidden item shared with write permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [hiddenVisibility] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: { [ITEM.id]: writeMembership }, errors: [] };
      });
    });
    it.each(['read', 'write'] as const)('request %s should return', async (permission) => {
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.data[ITEM.id],
      ).toEqual(writeMembership);
    });
    it.each([{ permission: 'admin' as const, rejects: MemberCannotAdminItem }])(
      'request $permission should return error',
      async ({ permission, rejects }) => {
        expect(
          (
            await authorizationService.getPropertiesForItems(MOCK_DB, {
              permission,
              accountId: MEMBER.id,
              items: [ITEM],
            })
          ).itemMemberships.errors[0],
        ).toBeInstanceOf(rejects);
      },
    );
  });

  describe('hidden item shared with admin permission', () => {
    it.each(['read', 'write', 'admin'] as const)('request %s should return', async (permission) => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [hiddenVisibility] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: { [ITEM.id]: adminMembership }, errors: [] };
      });
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.data[ITEM.id],
      ).toEqual(adminMembership);
    });
  });

  describe('public and hidden item shared without permission', () => {
    it.each([
      { permission: 'read' as const, rejects: MemberCannotAccess },
      { permission: 'write' as const, rejects: MemberCannotAccess },
      { permission: 'admin' as const, rejects: MemberCannotAccess },
    ])('request $permission should return error', async ({ permission, rejects }) => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [publicVisibility, hiddenVisibility] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: {}, errors: [] };
      });
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.errors[0],
      ).toBeInstanceOf(rejects);
    });
  });

  describe('public and hidden item shared with read permission', () => {
    it.each([
      { permission: 'read' as const, rejects: MemberCannotAccess },
      { permission: 'write' as const, rejects: MemberCannotAccess },
      { permission: 'admin' as const, rejects: MemberCannotAccess },
    ])('request $permission should return error', async ({ permission, rejects }) => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [publicVisibility, hiddenVisibility] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: { [ITEM.id]: readMembership }, errors: [] };
      });
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.errors[0],
      ).toBeInstanceOf(rejects);
    });
  });

  describe('public and hidden item shared with write permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [publicVisibility, hiddenVisibility] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: { [ITEM.id]: writeMembership }, errors: [] };
      });
    });
    it.each(['read', 'write'] as const)('request %s should return', async (permission) => {
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.data[ITEM.id],
      ).toEqual(writeMembership);
    });
    it.each([{ permission: 'admin' as const, rejects: MemberCannotAdminItem }])(
      'request $permission should return error',
      async ({ permission, rejects }) => {
        expect(
          (
            await authorizationService.getPropertiesForItems(MOCK_DB, {
              permission,
              accountId: MEMBER.id,
              items: [ITEM],
            })
          ).itemMemberships.errors[0],
        ).toBeInstanceOf(rejects);
      },
    );
  });

  describe('public and hidden item shared with admin permission', () => {
    it.each(['read', 'write', 'admin'] as const)('request %s should return', async (permission) => {
      vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
        data: { [ITEM.id]: [publicVisibility, hiddenVisibility] },
        errors: [],
      });

      vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(async () => {
        return { data: { [ITEM.id]: adminMembership }, errors: [] };
      });
      expect(
        (
          await authorizationService.getPropertiesForItems(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            items: [ITEM],
          })
        ).itemMemberships.data[ITEM.id],
      ).toEqual(adminMembership);
    });
  });
});

describe('getPropertiesForItems for many items', () => {
  const SHARED_MEMBER = { id: 'shared', name: 'shared' };
  const SHARED_ITEM = ItemFactory({ id: 'shared-item' });
  const PUBLIC_ITEM = ItemFactory({ id: 'public-item' });
  const sharedMembership = buildSharedMembership('write', SHARED_ITEM);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Public item & Shared write item', async () => {
    vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockImplementation(async () => ({
      data: {
        [PUBLIC_ITEM.id]: [ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM })],
        [SHARED_ITEM.id]: [],
      },
      errors: [],
    }));

    vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockImplementation(
      async (_db, _items, _memberId) => ({
        data: { [SHARED_ITEM.id]: sharedMembership },
        errors: [],
      }),
    );
    // shared member can read both items
    const { itemMemberships: result } = await authorizationService.getPropertiesForItems(MOCK_DB, {
      permission: 'read' as const,
      accountId: SHARED_MEMBER.id,
      items: [SHARED_ITEM, PUBLIC_ITEM],
    });
    expect(result.data[SHARED_ITEM.id]).toEqual(sharedMembership);
    expect(result.data[PUBLIC_ITEM.id]).toEqual(null);

    // shared member cannot write public item
    const { itemMemberships: result1 } = await authorizationService.getPropertiesForItems(MOCK_DB, {
      permission: 'write' as const,
      accountId: SHARED_MEMBER.id,
      items: [SHARED_ITEM, PUBLIC_ITEM],
    });
    expect(result1.data[SHARED_ITEM.id]).toEqual(sharedMembership);
    expect(result1.data[PUBLIC_ITEM.id]).toBeUndefined();
    expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

    // shared member cannot admin
    const { itemMemberships: result2 } = await authorizationService.getPropertiesForItems(MOCK_DB, {
      permission: 'admin' as const,
      accountId: SHARED_MEMBER.id,
      items: [SHARED_ITEM, PUBLIC_ITEM],
    });
    expect(result2.errors[0]).toBeInstanceOf(MemberCannotAdminItem);
    expect(result2.data[PUBLIC_ITEM.id]).toBeUndefined();
    expect(result2.errors[1]).toBeInstanceOf(MemberCannotAccess);
  });
});

describe('getPropertiesForItems for no items', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it('Should return empty data', async () => {
    vi.spyOn(itemVisibilityRepository, 'getManyForMany').mockResolvedValue({
      data: { [ITEM.id]: [] },
      errors: [],
    });

    vi.spyOn(itemMembershipRepository, 'getInheritedMany').mockResolvedValue({
      data: {},
      errors: [],
    });

    const res = await authorizationService.getPropertiesForItems(MOCK_DB, {
      permission: 'admin' as const,
      accountId: MEMBER.id,
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
