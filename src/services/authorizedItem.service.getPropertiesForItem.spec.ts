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

describe('getPropertiesForItem', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('Invalid saved membership', async () => {
    vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);

    vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(
      async () => ({ permission: 'anything' }) as unknown as ItemMembershipWithItemAndAccount,
    );

    // any other member shouldn't access
    await expect(
      authorizationService.getPropertiesForItem(MOCK_DB, {
        permission: 'admin' as const,
        accountId: MEMBER.id,
        item: ITEM,
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  describe('private item shared without permission', () => {
    it.each([
      { permission: 'read' as const, rejects: MemberCannotAccess },
      { permission: 'write' as const, rejects: MemberCannotAccess },
      { permission: 'admin' as const, rejects: MemberCannotAccess },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(async () => null);

      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });

  describe('private item shared with read permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(
        async () => readMembership,
      );
    });
    it.each(['read' as const])('request %s should return', async (permission) => {
      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: readMembership });
    });
    it.each([
      { permission: 'write' as const, rejects: MemberCannotWriteItem },
      { permission: 'admin' as const, rejects: MemberCannotAdminItem },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });

  describe('private item shared with write permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(
        async () => writeMembership,
      );
    });
    it.each(['read', 'write'] as const)('request %s should return', async (permission) => {
      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: writeMembership });
    });
    it.each([{ permission: 'admin' as const, rejects: MemberCannotAdminItem }])(
      'request $permission should throw',
      async ({ permission, rejects }) => {
        await expect(
          authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            item: ITEM,
          }),
        ).rejects.toBeInstanceOf(rejects);
      },
    );
  });
  describe('private item shared with admin permission', () => {
    it.each(['read', 'write', 'admin'] as const)('request %s should return', async (permission) => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(
        async () => adminMembership,
      );
      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: adminMembership });
    });
  });

  describe('public item shared without permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(async () => [
        publicVisibility,
      ]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(async () => null);
    });
    it.each(['read' as const])('request %s should return', async (permission) => {
      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: null });
    });
    it.each([
      {
        permission: 'write' as const,
        rejects: MemberCannotAccess,
      },
      {
        permission: 'admin' as const,
        rejects: MemberCannotAccess,
      },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });

  describe('public item shared with read permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(async () => [
        publicVisibility,
      ]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(
        async () => readMembership,
      );
    });
    it.each(['read' as const])('request %s should return', async (permission) => {
      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: readMembership });
    });
    it.each([
      {
        permission: 'write' as const,
        rejects: MemberCannotWriteItem,
      },
      {
        permission: 'admin' as const,
        rejects: MemberCannotAdminItem,
      },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });

  describe('public item shared with write permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(async () => [
        publicVisibility,
      ]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(
        async () => writeMembership,
      );
    });
    it.each(['read', 'write'] as const)('request %s should return', async (permission) => {
      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: writeMembership });
    });
    it.each([
      {
        permission: 'admin' as const,
        rejects: MemberCannotAdminItem,
      },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });

  describe('public item shared with admin permission', () => {
    it.each(['read', 'write', 'admin'] as const)('request %s should return', async (permission) => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(async () => [
        publicVisibility,
      ]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(
        async () => adminMembership,
      );

      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: adminMembership });
    });
  });

  describe('hidden item shared without permission', () => {
    it.each([
      {
        permission: 'read' as const,
        rejects: MemberCannotAccess,
      },
      {
        permission: 'write' as const,
        rejects: MemberCannotAccess,
      },
      {
        permission: 'admin' as const,
        rejects: MemberCannotAccess,
      },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(async () => [
        hiddenVisibility,
      ]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(async () => null);

      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });
  describe('hidden item shared with read permission', () => {
    it.each([
      { permission: 'read' as const, rejects: MemberCannotAccess },
      { permission: 'write' as const, rejects: MemberCannotAccess },
      { permission: 'admin' as const, rejects: MemberCannotAccess },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(async () => [
        hiddenVisibility,
      ]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(
        async () => readMembership,
      );

      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });
  describe('hidden item shared with write permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(async () => [
        hiddenVisibility,
      ]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(
        async () => writeMembership,
      );
    });
    it.each(['read', 'write'] as const)('request %s should return', async (permission) => {
      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: writeMembership });
    });
    it.each([{ permission: 'admin' as const, rejects: MemberCannotAdminItem }])(
      'request $permission should throw',
      async ({ permission, rejects }) => {
        await expect(
          authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            item: ITEM,
          }),
        ).rejects.toBeInstanceOf(rejects);
      },
    );
  });
  describe('hidden item shared with admin permission', () => {
    it.each(['read', 'write', 'admin'] as const)('request %s should return', async (permission) => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(async () => [
        hiddenVisibility,
      ]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(
        async () => adminMembership,
      );

      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: adminMembership });
    });
  });

  describe('public and hidden item shared without permission', () => {
    it.each([
      { permission: 'read' as const, rejects: MemberCannotAccess },
      { permission: 'write' as const, rejects: MemberCannotAccess },
      { permission: 'admin' as const, rejects: MemberCannotAccess },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(async () => [
        publicVisibility,
        hiddenVisibility,
      ]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(async () => null);

      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });
  describe('public and hidden item shared with read permission', () => {
    it.each([
      { permission: 'read' as const, rejects: MemberCannotAccess },
      { permission: 'write' as const, rejects: MemberCannotAccess },
      { permission: 'admin' as const, rejects: MemberCannotAccess },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(async () => [
        publicVisibility,
        hiddenVisibility,
      ]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(
        async () => readMembership,
      );

      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });
  describe('public and hidden item shared with write permission', () => {
    beforeEach(() => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(async () => [
        publicVisibility,
        hiddenVisibility,
      ]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(
        async () => writeMembership,
      );
    });
    it.each(['read', 'write'] as const)('request %s should return', async (permission) => {
      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: writeMembership });
    });
    it.each([{ permission: 'admin' as const, rejects: MemberCannotAdminItem }])(
      'request $permission should throw',
      async ({ permission, rejects }) => {
        await expect(
          authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            accountId: MEMBER.id,
            item: ITEM,
          }),
        ).rejects.toBeInstanceOf(rejects);
      },
    );
  });
  describe('public and hidden item shared with admin permission', () => {
    it.each(['read', 'write', 'admin'] as const)('request %s should return', async (permission) => {
      vi.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(async () => [
        publicVisibility,
        hiddenVisibility,
      ]);
      vi.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(
        async () => adminMembership,
      );

      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          accountId: MEMBER.id,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: adminMembership });
    });
  });
});
