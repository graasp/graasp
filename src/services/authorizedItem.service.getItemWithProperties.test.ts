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

describe('getItemWithProperties', () => {
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
      authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Read,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Read,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotWriteItem);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Read,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Read,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can admin
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // other member can read
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // other member can read
      const { itemMembership: result2 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, item: ITEM },
      );
      expect(result2).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't write
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotWriteItem);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't admin
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // other member can read
      const { itemMembership: result2 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, item: ITEM },
      );
      expect(result2).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't admin
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // other member can read
      const { itemMembership: result2 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: OTHER_MEMBER, item: ITEM },
      );
      expect(result2).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can admin
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member cannot read
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Read,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // other member cannot read
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Read,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member cannot read
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member cannot read
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't admin
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member can admin
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Read,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Read,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Read,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Read,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: SHARED_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
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
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Read,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Read, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Read,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Write,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Write, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Write,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await authorizationService.getItemWithProperties(MOCK_DB, {
        permission: PermissionLevel.Admin,
        actor: OWNER,
        item: ITEM,
      });
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await authorizationService.getItemWithProperties(
        MOCK_DB,
        { permission: PermissionLevel.Admin, actor: SHARED_MEMBER, item: ITEM },
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        authorizationService.getItemWithProperties(MOCK_DB, {
          permission: PermissionLevel.Admin,
          actor: OTHER_MEMBER,
          item: ITEM,
        }),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });
});
