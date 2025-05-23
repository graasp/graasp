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

  describe('private item shared without permission', () => {
    it.each([
      { permission: PermissionLevel.Read, rejects: MemberCannotAccess },
      { permission: PermissionLevel.Write, rejects: MemberCannotAccess },
      { permission: PermissionLevel.Admin, rejects: MemberCannotAccess },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);
      jest.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(async () => null);

      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });

  describe('private item shared with read permission', () => {
    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async () => readMembership);
    });
    it.each([PermissionLevel.Read])('request %s should return', async (permission) => {
      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: readMembership });
    });
    it.each([
      { permission: PermissionLevel.Write, rejects: MemberCannotWriteItem },
      { permission: PermissionLevel.Admin, rejects: MemberCannotAdminItem },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });

  describe('private item shared with write permission', () => {
    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async () => writeMembership);
    });
    it.each([PermissionLevel.Read, PermissionLevel.Write])(
      'request %s should return',
      async (permission) => {
        expect(
          await authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            actor: MEMBER,
            item: ITEM,
          }),
        ).toMatchObject({ itemMembership: writeMembership });
      },
    );
    it.each([{ permission: PermissionLevel.Admin, rejects: MemberCannotAdminItem }])(
      'request $permission should throw',
      async ({ permission, rejects }) => {
        await expect(
          authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            actor: MEMBER,
            item: ITEM,
          }),
        ).rejects.toBeInstanceOf(rejects);
      },
    );
  });
  describe('private item shared with admin permission', () => {
    it.each([PermissionLevel.Read, PermissionLevel.Write, PermissionLevel.Admin])(
      'request %s should return',
      async (permission) => {
        jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);
        jest
          .spyOn(itemMembershipRepository, 'getInherited')
          .mockImplementation(async () => adminMembership);
        expect(
          await authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            actor: MEMBER,
            item: ITEM,
          }),
        ).toMatchObject({ itemMembership: adminMembership });
      },
    );
  });

  describe('public item shared without permission', () => {
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [publicVisibility]);
      jest.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(async () => null);
    });
    it.each([PermissionLevel.Read])('request %s should return', async (permission) => {
      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: null });
    });
    it.each([
      {
        permission: PermissionLevel.Write,
        rejects: MemberCannotAccess,
      },
      {
        permission: PermissionLevel.Admin,
        rejects: MemberCannotAccess,
      },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });

  describe('public item shared with read permission', () => {
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [publicVisibility]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async () => readMembership);
    });
    it.each([PermissionLevel.Read])('request %s should return', async (permission) => {
      expect(
        await authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        }),
      ).toMatchObject({ itemMembership: readMembership });
    });
    it.each([
      {
        permission: PermissionLevel.Write,
        rejects: MemberCannotWriteItem,
      },
      {
        permission: PermissionLevel.Admin,
        rejects: MemberCannotAdminItem,
      },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });

  describe('public item shared with write permission', () => {
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [publicVisibility]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async () => writeMembership);
    });
    it.each([PermissionLevel.Read, PermissionLevel.Write])(
      'request %s should return',
      async (permission) => {
        expect(
          await authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            actor: MEMBER,
            item: ITEM,
          }),
        ).toMatchObject({ itemMembership: writeMembership });
      },
    );
    it.each([
      {
        permission: PermissionLevel.Admin,
        rejects: MemberCannotAdminItem,
      },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });

  describe('public item shared with admin permission', () => {
    it.each([PermissionLevel.Read, PermissionLevel.Write, PermissionLevel.Admin])(
      'request %s should return',
      async (permission) => {
        jest
          .spyOn(itemVisibilityRepository, 'getByItemPath')
          .mockImplementation(async () => [publicVisibility]);
        jest
          .spyOn(itemMembershipRepository, 'getInherited')
          .mockImplementation(async () => adminMembership);

        expect(
          await authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            actor: MEMBER,
            item: ITEM,
          }),
        ).toMatchObject({ itemMembership: adminMembership });
      },
    );
  });

  describe('hidden item shared without permission', () => {
    it.each([
      {
        permission: PermissionLevel.Read,
        rejects: MemberCannotAccess,
      },
      {
        permission: PermissionLevel.Write,
        rejects: MemberCannotAccess,
      },
      {
        permission: PermissionLevel.Admin,
        rejects: MemberCannotAccess,
      },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [hiddenVisibility]);
      jest.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(async () => null);

      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });
  describe('hidden item shared with read permission', () => {
    it.each([
      { permission: PermissionLevel.Read, rejects: MemberCannotAccess },
      { permission: PermissionLevel.Write, rejects: MemberCannotAccess },
      { permission: PermissionLevel.Admin, rejects: MemberCannotAccess },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [hiddenVisibility]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async () => readMembership);

      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });
  describe('hidden item shared with write permission', () => {
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [hiddenVisibility]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async () => writeMembership);
    });
    it.each([PermissionLevel.Read, PermissionLevel.Write])(
      'request %s should return',
      async (permission) => {
        expect(
          await authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            actor: MEMBER,
            item: ITEM,
          }),
        ).toMatchObject({ itemMembership: writeMembership });
      },
    );
    it.each([{ permission: PermissionLevel.Admin, rejects: MemberCannotAdminItem }])(
      'request $permission should throw',
      async ({ permission, rejects }) => {
        await expect(
          authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            actor: MEMBER,
            item: ITEM,
          }),
        ).rejects.toBeInstanceOf(rejects);
      },
    );
  });
  describe('hidden item shared with admin permission', () => {
    it.each([PermissionLevel.Read, PermissionLevel.Write, PermissionLevel.Admin])(
      'request %s should return',
      async (permission) => {
        jest
          .spyOn(itemVisibilityRepository, 'getByItemPath')
          .mockImplementation(async () => [hiddenVisibility]);
        jest
          .spyOn(itemMembershipRepository, 'getInherited')
          .mockImplementation(async () => adminMembership);

        expect(
          await authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            actor: MEMBER,
            item: ITEM,
          }),
        ).toMatchObject({ itemMembership: adminMembership });
      },
    );
  });

  describe('public and hidden item shared without permission', () => {
    it.each([
      { permission: PermissionLevel.Read, rejects: MemberCannotAccess },
      { permission: PermissionLevel.Write, rejects: MemberCannotAccess },
      { permission: PermissionLevel.Admin, rejects: MemberCannotAccess },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [publicVisibility, hiddenVisibility]);
      jest.spyOn(itemMembershipRepository, 'getInherited').mockImplementation(async () => null);

      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });
  describe('public and hidden item shared with read permission', () => {
    it.each([
      { permission: PermissionLevel.Read, rejects: MemberCannotAccess },
      { permission: PermissionLevel.Write, rejects: MemberCannotAccess },
      { permission: PermissionLevel.Admin, rejects: MemberCannotAccess },
    ])('request $permission should throw', async ({ permission, rejects }) => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [publicVisibility, hiddenVisibility]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async () => readMembership);

      await expect(
        authorizationService.getPropertiesForItem(MOCK_DB, {
          permission,
          actor: MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(rejects);
    });
  });
  describe('public and hidden item shared with write permission', () => {
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [publicVisibility, hiddenVisibility]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async () => writeMembership);
    });
    it.each([PermissionLevel.Read, PermissionLevel.Write])(
      'request %s should return',
      async (permission) => {
        expect(
          await authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            actor: MEMBER,
            item: ITEM,
          }),
        ).toMatchObject({ itemMembership: writeMembership });
      },
    );
    it.each([{ permission: PermissionLevel.Admin, rejects: MemberCannotAdminItem }])(
      'request $permission should throw',
      async ({ permission, rejects }) => {
        await expect(
          authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            actor: MEMBER,
            item: ITEM,
          }),
        ).rejects.toBeInstanceOf(rejects);
      },
    );
  });
  describe('public and hidden item shared with admin permission', () => {
    it.each([PermissionLevel.Read, PermissionLevel.Write, PermissionLevel.Admin])(
      'request %s should return',
      async (permission) => {
        jest
          .spyOn(itemVisibilityRepository, 'getByItemPath')
          .mockImplementation(async () => [publicVisibility, hiddenVisibility]);
        jest
          .spyOn(itemMembershipRepository, 'getInherited')
          .mockImplementation(async () => adminMembership);

        expect(
          await authorizationService.getPropertiesForItem(MOCK_DB, {
            permission,
            actor: MEMBER,
            item: ITEM,
          }),
        ).toMatchObject({ itemMembership: adminMembership });
      },
    );
  });
});
