import { ItemVisibilityType, PermissionLevel, PermissionLevelOptions } from '@graasp/sdk';

import { ItemFactory } from '../../test/factories/item.factory';
import { ItemVisibilityFactory } from '../../test/factories/itemVisibility.factory';
import { DBConnection } from '../drizzle/db';
import { ItemMembershipWithItemAndAccount, ItemRaw } from '../drizzle/types';
import { MemberCannotAccess, MemberCannotAdminItem, MemberCannotWriteItem } from '../utils/errors';
import { AuthorizationService } from './authorization';
import { ItemVisibilityRepository } from './item/plugins/itemVisibility/itemVisibility.repository';
import { ItemMembershipRepository } from './itemMembership/membership.repository';

const MOCK_DB = {} as unknown as DBConnection;

const OWNER = { id: 'owner', name: 'owner' };
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

const authorizationService = new AuthorizationService(
  itemMembershipRepository,
  itemVisibilityRepository,
);

// TODO: Update suite to test the Authorization service which was added to convert the single functions we had previously
describe('validatePermission', () => {
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
      authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OWNER, ITEM),
    ).rejects.toBeInstanceOf(Error);
  });

  describe('Private item', () => {
    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          if (memberId === OWNER.id) {
            return ownerMembership;
          }

          return null;
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Shared item with Read permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Read);
    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(
          MOCK_DB,
          PermissionLevel.Write,
          SHARED_MEMBER,
          ITEM,
        ),
      ).rejects.toBeInstanceOf(MemberCannotWriteItem);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(
          MOCK_DB,
          PermissionLevel.Admin,
          SHARED_MEMBER,
          ITEM,
        ),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Shared item with Write permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write);
    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(
          MOCK_DB,
          PermissionLevel.Admin,
          SHARED_MEMBER,
          ITEM,
        ),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Shared item with Admin permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Admin);
    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockResolvedValue([]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can admin
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item', () => {
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [
          ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
        ]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          if (memberId === OWNER.id) {
            return ownerMembership;
          }

          return null;
        });
    });
    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // other member can read
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item with shared read permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Read);

    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [
          ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
        ]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // other member can read
      const { itemMembership: result2 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        ITEM,
      );
      expect(result2).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't write
      await expect(
        authorizationService.validatePermission(
          MOCK_DB,
          PermissionLevel.Write,
          SHARED_MEMBER,
          ITEM,
        ),
      ).rejects.toBeInstanceOf(MemberCannotWriteItem);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't admin
      await expect(
        authorizationService.validatePermission(
          MOCK_DB,
          PermissionLevel.Admin,
          SHARED_MEMBER,
          ITEM,
        ),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item with shared write permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write);
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [
          ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
        ]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // other member can read
      const { itemMembership: result2 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        ITEM,
      );
      expect(result2).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't admin
      await expect(
        authorizationService.validatePermission(
          MOCK_DB,
          PermissionLevel.Admin,
          SHARED_MEMBER,
          ITEM,
        ),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item with shared admin permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Admin);
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [
          ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
        ]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // other member can read
      const { itemMembership: result2 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        ITEM,
      );
      expect(result2).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can admin
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Hidden item with shared read permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Read);

    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [
          ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
        ]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member cannot read
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Read, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // other member cannot read
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member cannot read
      await expect(
        authorizationService.validatePermission(
          MOCK_DB,
          PermissionLevel.Write,
          SHARED_MEMBER,
          ITEM,
        ),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member cannot read
      await expect(
        authorizationService.validatePermission(
          MOCK_DB,
          PermissionLevel.Admin,
          SHARED_MEMBER,
          ITEM,
        ),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Hidden item with shared with write permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write);

    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [
          ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
        ]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't admin
      await expect(
        authorizationService.validatePermission(
          MOCK_DB,
          PermissionLevel.Admin,
          SHARED_MEMBER,
          ITEM,
        ),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Hidden item with shared with admin permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Admin);

    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [
          ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
        ]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can admin
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public & Hidden item', () => {
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [
          ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
          ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
        ]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          if (memberId === OWNER.id) {
            return ownerMembership;
          }

          return null;
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public & Hidden item with shared read permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Read);

    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [
          ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
          ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
        ]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Read, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't access
      await expect(
        authorizationService.validatePermission(
          MOCK_DB,
          PermissionLevel.Write,
          SHARED_MEMBER,
          ITEM,
        ),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't access
      await expect(
        authorizationService.validatePermission(
          MOCK_DB,
          PermissionLevel.Admin,
          SHARED_MEMBER,
          ITEM,
        ),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public & Hidden item with shared write permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write);

    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [
          ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
          ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
        ]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't access
      await expect(
        authorizationService.validatePermission(
          MOCK_DB,
          PermissionLevel.Admin,
          SHARED_MEMBER,
          ITEM,
        ),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public & Hidden item with shared admin permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Admin);

    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [
          ItemVisibilityFactory({ type: ItemVisibilityType.Public, item: ITEM }),
          ItemVisibilityFactory({ type: ItemVisibilityType.Hidden, item: ITEM }),
        ]);
      jest
        .spyOn(itemMembershipRepository, 'getInherited')
        .mockImplementation(async (_db, _itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        });
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await authorizationService.validatePermission(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.validatePermission(MOCK_DB, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });
});

describe('validatePermissionMany for no items', () => {
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

    const res = await authorizationService.validatePermissionMany(
      MOCK_DB,
      PermissionLevel.Admin,
      OWNER,
      [],
    );
    const expected: Awaited<ReturnType<typeof authorizationService.validatePermissionMany>> = {
      itemMemberships: { data: {}, errors: [] },
      visibilities: { data: {}, errors: [] },
    };
    // any other member shouldn't access
    expect(res).toEqual(expected);
    expect(itemMembershipRepository.getInheritedMany).not.toHaveBeenCalled();
    expect(itemVisibilityRepository.getManyForMany).not.toHaveBeenCalled();
  });
});

describe('validatePermissionMany for one item', () => {
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
      authorizationService.validatePermissionMany(MOCK_DB, PermissionLevel.Admin, OWNER, [ITEM]),
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
      const { itemMemberships } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(itemMemberships.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member should pass
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotWriteItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member should pass
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member should pass
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can write
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can admin
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // other member can read
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member can read
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.data[ITEM.id]).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't write
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotWriteItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't admin
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member can read
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.data[ITEM.id]).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't write
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't admin
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member can read
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.data[ITEM.id]).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't write
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't admin
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot read
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
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
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it('PermissionLevel.Admin', async () => {
      // owner should pass
      const { itemMemberships: result } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot admin
      const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
        MOCK_DB,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });
});

describe('validatePermissionMany for many items', () => {
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
    const { itemMemberships: result } = await authorizationService.validatePermissionMany(
      MOCK_DB,
      PermissionLevel.Read,
      SHARED_MEMBER,
      [SHARED_ITEM, PUBLIC_ITEM],
    );
    expect(result.data[SHARED_ITEM.id]).toEqual(sharedMembership);
    expect(result.data[PUBLIC_ITEM.id]).toEqual(null);

    // shared member cannot write public item
    const { itemMemberships: result1 } = await authorizationService.validatePermissionMany(
      MOCK_DB,
      PermissionLevel.Write,
      SHARED_MEMBER,
      [SHARED_ITEM, PUBLIC_ITEM],
    );
    expect(result1.data[SHARED_ITEM.id]).toEqual(sharedMembership);
    expect(result1.data[PUBLIC_ITEM.id]).toBeUndefined();
    expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

    // shared member cannot admin
    const { itemMemberships: result2 } = await authorizationService.validatePermissionMany(
      MOCK_DB,
      PermissionLevel.Admin,
      SHARED_MEMBER,
      [SHARED_ITEM, PUBLIC_ITEM],
    );
    expect(result2.errors[0]).toBeInstanceOf(MemberCannotAdminItem);
    expect(result2.data[PUBLIC_ITEM.id]).toBeUndefined();
    expect(result2.errors[1]).toBeInstanceOf(MemberCannotAccess);
  });
});
