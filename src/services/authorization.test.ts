import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import {
  FolderItemFactory,
  ItemVisibilityType,
  PackedFolderItemFactory,
  PermissionLevel,
} from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../test/app';
import { ItemMembershipRepository } from '../services/itemMembership/repository';
import { asDefined } from '../utils/assertions';
import { MemberCannotAccess, MemberCannotAdminItem, MemberCannotWriteItem } from '../utils/errors';
import { Account } from './account/entities/account';
import { isAuthenticated } from './auth/plugins/passport';
import {
  filterOutPackedDescendants,
  matchOne,
  validatePermission,
  validatePermissionMany,
} from './authorization';
import { PackedItem } from './item/ItemWrapper';
import { Item } from './item/entities/Item';
import { ItemVisibility } from './item/plugins/itemVisibility/ItemVisibility';
import { ItemVisibilityRepository } from './item/plugins/itemVisibility/repository';
import { expectPackedItem } from './item/test/fixtures/items';
import { ItemMembership } from './itemMembership/entities/ItemMembership';
import { Member } from './member/entities/member';
import { validatedMemberAccountRole } from './member/strategies/validatedMemberAccountRole';
import { saveMember } from './member/test/fixtures/members';

const OWNER = { id: 'owner', name: 'owner' } as Account;
const SHARED_MEMBER = { id: 'shared', name: 'shared' } as Account;
const OTHER_MEMBER = { id: 'other', name: 'other' } as Member;
const ITEM = { id: 'item' } as Item;
const ownerMembership = { account: OWNER, permission: PermissionLevel.Admin } as ItemMembership;
const buildSharedMembership = (permission: PermissionLevel, item: Item = ITEM) =>
  ({ account: SHARED_MEMBER, permission, item }) as ItemMembership;

jest.mock('./item/plugins/itemVisibility/repository');

const itemVisibilityRepository = new ItemVisibilityRepository();
const getManyForManyMock = jest.spyOn(itemVisibilityRepository, 'getManyForMany');

const MOCK_ITEM_VISIBILITY_PUBLIC = { type: ItemVisibilityType.Public } as ItemVisibility;
const MOCK_ITEM_VISIBILITY_HIDDEN = { type: ItemVisibilityType.Hidden } as ItemVisibility;
const returnDummyArray = async () => [];

describe('validatePermission', () => {
  let repositories;

  afterEach(() => {
    jest.restoreAllMocks();
    getManyForManyMock.mockClear();
  });
  it('Invalid saved membership', async () => {
    jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(returnDummyArray);

    const repositories = {
      itemMembershipRepository: {
        getInherited: jest.fn(() => ({ permission: 'anything' })),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository,
    };

    // any other member shouldn't access
    await expect(
      validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM),
    ).rejects.toBeInstanceOf(Error);
  });

  describe('Private item', () => {
    beforeEach(() => {
      jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(returnDummyArray);
      repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn((_itemPath, memberId) =>
            memberId === OWNER.id ? ownerMembership : null,
          ),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Shared item with Read permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Read);

    jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(returnDummyArray);
    const repositories = {
      itemMembershipRepository: {
        getInherited: jest.fn((_itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        }),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository,
    };

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotWriteItem);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Shared item with Write permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write);

    jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(returnDummyArray);
    const repositories = {
      itemMembershipRepository: {
        getInherited: jest.fn((_itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        }),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository,
    };

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Shared item with Admin permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Admin);

    jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(returnDummyArray);
    const repositories = {
      itemMembershipRepository: {
        getInherited: jest.fn((_itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        }),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository,
    };

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can admin
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item', () => {
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [MOCK_ITEM_VISIBILITY_PUBLIC]);
      repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn(async (_itemPath, memberId) => {
            switch (memberId) {
              case OWNER.id:
                return ownerMembership;
              default:
                return null;
            }
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // other member can read
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item with shared read permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Read);
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [MOCK_ITEM_VISIBILITY_PUBLIC]);

      repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn(async (_itemPath, memberId) => {
            switch (memberId) {
              case OWNER.id:
                return ownerMembership;
              case SHARED_MEMBER.id:
                return sharedMembership;
              default:
                return null;
            }
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // other member can read
      const { itemMembership: result2 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        ITEM,
      );
      expect(result2).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't write
      await expect(
        validatePermission(repositories, PermissionLevel.Write, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotWriteItem);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't admin
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item with shared write permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write);
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [MOCK_ITEM_VISIBILITY_PUBLIC]);

      repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn(async (_itemPath, memberId) => {
            switch (memberId) {
              case OWNER.id:
                return ownerMembership;
              case SHARED_MEMBER.id:
                return sharedMembership;
              default:
                return null;
            }
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // other member can read
      const { itemMembership: result2 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        ITEM,
      );
      expect(result2).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't admin
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item with shared admin permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Admin);

    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [MOCK_ITEM_VISIBILITY_PUBLIC]);

      repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn(async (_itemPath, memberId) => {
            switch (memberId) {
              case OWNER.id:
                return ownerMembership;
              case SHARED_MEMBER.id:
                return sharedMembership;
              default:
                return null;
            }
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // other member can read
      const { itemMembership: result2 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        ITEM,
      );
      expect(result2).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can admin
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Hidden item with shared read permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Read);

    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [MOCK_ITEM_VISIBILITY_HIDDEN]);

      repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn(async (_itemPath, memberId) => {
            switch (memberId) {
              case OWNER.id:
                return ownerMembership;
              case SHARED_MEMBER.id:
                return sharedMembership;
              default:
                return null;
            }
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member cannot read
      await expect(
        validatePermission(repositories, PermissionLevel.Read, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // other member cannot read
      await expect(
        validatePermission(repositories, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member cannot read
      await expect(
        validatePermission(repositories, PermissionLevel.Write, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member cannot read
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Hidden item with shared with write permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write);
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [MOCK_ITEM_VISIBILITY_HIDDEN]);

      repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn(async (_itemPath, memberId) => {
            switch (memberId) {
              case OWNER.id:
                return ownerMembership;
              case SHARED_MEMBER.id:
                return sharedMembership;
              default:
                return null;
            }
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });
    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't admin
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Hidden item with shared with admin permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Admin);

    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [MOCK_ITEM_VISIBILITY_HIDDEN]);

      repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn(async (_itemPath, memberId) => {
            switch (memberId) {
              case OWNER.id:
                return ownerMembership;
              case SHARED_MEMBER.id:
                return sharedMembership;
              default:
                return null;
            }
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can read
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can write
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member can admin
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public & Hidden item', () => {
    beforeEach(() => {
      jest
        .spyOn(itemVisibilityRepository, 'getByItemPath')
        .mockImplementation(async () => [MOCK_ITEM_VISIBILITY_HIDDEN, MOCK_ITEM_VISIBILITY_PUBLIC]);

      repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn(async (_itemPath, memberId) => {
            switch (memberId) {
              case OWNER.id:
                return ownerMembership;
              default:
                return null;
            }
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public & Hidden item with shared read permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Read);

    jest
      .spyOn(itemVisibilityRepository, 'getByItemPath')
      .mockImplementation(async () => [MOCK_ITEM_VISIBILITY_HIDDEN, MOCK_ITEM_VISIBILITY_PUBLIC]);
    const repositories = {
      itemMembershipRepository: {
        getInherited: jest.fn(async (_itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        }),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository,
    };

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Read, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public & Hidden item with shared write permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write);

    jest
      .spyOn(itemVisibilityRepository, 'getByItemPath')
      .mockImplementation(async () => [MOCK_ITEM_VISIBILITY_HIDDEN, MOCK_ITEM_VISIBILITY_PUBLIC]);
    const repositories = {
      itemMembershipRepository: {
        getInherited: jest.fn(async (_itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        }),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository,
    };

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, SHARED_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public & Hidden item with shared admin permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Admin);

    jest
      .spyOn(itemVisibilityRepository, 'getByItemPath')
      .mockImplementation(async () => [MOCK_ITEM_VISIBILITY_HIDDEN, MOCK_ITEM_VISIBILITY_PUBLIC]);
    const repositories = {
      itemMembershipRepository: {
        getInherited: jest.fn(async (_itemPath, memberId) => {
          switch (memberId) {
            case OWNER.id:
              return ownerMembership;
            case SHARED_MEMBER.id:
              return sharedMembership;
            default:
              return null;
          }
        }),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository,
    };

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Read, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMembership: result } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        ITEM,
      );
      expect(result).toEqual(ownerMembership);

      // shared member should pass
      const { itemMembership: result1 } = await validatePermission(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        ITEM,
      );
      expect(result1).toEqual(sharedMembership);

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
      ).rejects.toBeInstanceOf(MemberCannotAccess);
    });
  });
});

describe('validatePermissionMany for no items', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    getManyForManyMock.mockClear();
  });
  it('Should return empty data', async () => {
    jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(returnDummyArray);
    const repositories = {
      itemMembershipRepository: {
        getInheritedMany: jest.fn(() => ({ permission: 'anything' })),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository,
    };

    const res = await validatePermissionMany(repositories, PermissionLevel.Admin, OWNER, []);
    const expected: Awaited<ReturnType<typeof validatePermissionMany>> = {
      itemMemberships: { data: {}, errors: [] },
      visibilities: { data: {}, errors: [] },
    };
    // any other member shouldn't access
    expect(res).toEqual(expected);
    expect(repositories.itemMembershipRepository.getInheritedMany).not.toHaveBeenCalled();
    expect(repositories.itemVisibilityRepository.getManyForMany).not.toHaveBeenCalled();
  });
});

describe('validatePermissionMany for one item', () => {
  let repositories;

  afterEach(() => {
    jest.restoreAllMocks();
    getManyForManyMock.mockClear();
  });

  it('Invalid saved membership', async () => {
    jest.spyOn(itemVisibilityRepository, 'getByItemPath').mockImplementation(returnDummyArray);
    const repositories = {
      itemMembershipRepository: {
        getInheritedMany: jest.fn(() => ({ permission: 'anything' })),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository,
    };

    // any other member shouldn't access
    await expect(
      validatePermissionMany(repositories, PermissionLevel.Admin, OWNER, [ITEM]),
    ).rejects.toBeInstanceOf(Error);
  });

  describe('Private item', () => {
    beforeEach(() => {
      getManyForManyMock.mockImplementation(async () => ({
        data: { [ITEM.id]: [] },
        errors: [],
      }));
      repositories = {
        itemMembershipRepository: {
          getInheritedMany: jest.fn((_items, memberId) => {
            let im;

            switch (memberId) {
              case OWNER.id:
                im = ownerMembership;
                break;

              default:
                break;
            }
            return { data: { [ITEM.id]: im }, errors: [] };
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });
    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(itemMemberships.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
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
      getManyForManyMock.mockImplementation(async () => ({
        data: { [ITEM.id]: [] },
        errors: [],
      }));

      repositories = {
        itemMembershipRepository: {
          getInheritedMany: jest.fn((_items, memberId) => {
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
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member should pass
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't access
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotWriteItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't access
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
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
      getManyForManyMock.mockImplementation(async () => ({
        data: { [ITEM.id]: [] },
        errors: [],
      }));
      repositories = {
        itemMembershipRepository: {
          getInheritedMany: jest.fn((_items, memberId) => {
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
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member should pass
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member should pass
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't access
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
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
      getManyForManyMock.mockImplementation(async () => ({
        data: { [ITEM.id]: [] },
        errors: [],
      }));
      repositories = {
        itemMembershipRepository: {
          getInheritedMany: jest.fn((_items, memberId) => {
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
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can write
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can admin
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item', () => {
    beforeEach(() => {
      getManyForManyMock.mockImplementation(async () => ({
        data: { [ITEM.id]: [MOCK_ITEM_VISIBILITY_PUBLIC] },
        errors: [],
      }));
      repositories = {
        itemMembershipRepository: {
          getInheritedMany: jest.fn((_items, memberId) => {
            let im;

            switch (memberId) {
              case OWNER.id:
                im = ownerMembership;
                break;

              default:
                break;
            }
            return { data: { [ITEM.id]: im }, errors: [] };
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // other member can read
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // any other member shouldn't access
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
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
      getManyForManyMock.mockImplementation(async () => ({
        data: { [ITEM.id]: [MOCK_ITEM_VISIBILITY_PUBLIC] },
        errors: [],
      }));

      repositories = {
        itemMembershipRepository: {
          getInheritedMany: jest.fn((_items, memberId) => {
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
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });
    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member can read
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.data[ITEM.id]).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't write
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotWriteItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't admin
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item with shared write permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write);

    getManyForManyMock.mockImplementation(async () => ({
      data: { [ITEM.id]: [MOCK_ITEM_VISIBILITY_PUBLIC] },
      errors: [],
    }));

    const repositories = {
      itemMembershipRepository: {
        getInheritedMany: jest.fn((_items, memberId) => {
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
        }),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository,
    };

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member can read
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.data[ITEM.id]).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't write
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't admin
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public item with shared admin permission', () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Admin);

    getManyForManyMock.mockImplementation(async () => {
      return {
        data: { [ITEM.id]: [MOCK_ITEM_VISIBILITY_PUBLIC] },
        errors: [],
      };
    });

    const repositories = {
      itemMembershipRepository: {
        getInheritedMany: jest.fn((_items, memberId) => {
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
        }),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository,
    };

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member can read
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.data[ITEM.id]).toEqual(null);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't write
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member shouldn't admin
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // any other member shouldn't access
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
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
      getManyForManyMock.mockImplementation(async () => ({
        data: { [ITEM.id]: [MOCK_ITEM_VISIBILITY_HIDDEN] },
        errors: [],
      }));

      repositories = {
        itemMembershipRepository: {
          getInheritedMany: jest.fn((_items, memberId) => {
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
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });
    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot read
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot read
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot write
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot admin
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
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
      getManyForManyMock.mockImplementation(async () => ({
        data: { [ITEM.id]: [MOCK_ITEM_VISIBILITY_HIDDEN] },
        errors: [],
      }));

      repositories = {
        itemMembershipRepository: {
          getInheritedMany: jest.fn((_items, memberId) => {
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
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // other member cannot admin
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
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
      getManyForManyMock.mockImplementation(async () => ({
        data: { [ITEM.id]: [MOCK_ITEM_VISIBILITY_HIDDEN] },
        errors: [],
      }));

      repositories = {
        itemMembershipRepository: {
          getInheritedMany: jest.fn((_items, memberId) => {
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
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot admin
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });

  describe('Public & Hidden item', () => {
    beforeEach(() => {
      getManyForManyMock.mockImplementation(async () => ({
        data: { [ITEM.id]: [MOCK_ITEM_VISIBILITY_HIDDEN, MOCK_ITEM_VISIBILITY_PUBLIC] },
        errors: [],
      }));
      repositories = {
        itemMembershipRepository: {
          getInheritedMany: jest.fn((_items, memberId) => {
            let im;

            switch (memberId) {
              case OWNER.id:
                im = ownerMembership;
                break;

              default:
                break;
            }
            return { data: { [ITEM.id]: im }, errors: [] };
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // other member cannot admin
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
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
      getManyForManyMock.mockImplementation(async () => ({
        data: { [ITEM.id]: [MOCK_ITEM_VISIBILITY_HIDDEN] },
        errors: [],
      }));
      repositories = {
        itemMembershipRepository: {
          getInheritedMany: jest.fn((_items, memberId) => {
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
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot read
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot write
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

      // other member cannot admin
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
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
      getManyForManyMock.mockImplementation(async () => ({
        data: { [ITEM.id]: [MOCK_ITEM_VISIBILITY_HIDDEN] },
        errors: [],
      }));
      repositories = {
        itemMembershipRepository: {
          getInheritedMany: jest.fn((_items, memberId) => {
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
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it(PermissionLevel.Admin, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.errors[0]).toBeInstanceOf(MemberCannotAdminItem);

      // other member cannot admin
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
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
      getManyForManyMock.mockImplementation(async () => ({
        data: { [ITEM.id]: [MOCK_ITEM_VISIBILITY_HIDDEN] },
        errors: [],
      }));
      repositories = {
        itemMembershipRepository: {
          getInheritedMany: jest.fn((_items, memberId) => {
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
          }),
        } as unknown as ItemMembershipRepository,
        itemVisibilityRepository,
      };
    });

    it(PermissionLevel.Read, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member can read
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot read
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Read,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
    it(PermissionLevel.Write, async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot write
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot write
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Write,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });

    it('PermissionLevel.Admin', async () => {
      // owner should pass
      const { itemMemberships: result } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OWNER,
        [ITEM],
      );
      expect(result.data[ITEM.id]).toEqual(ownerMembership);

      // shared member cannot admin
      const { itemMemberships: result1 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        SHARED_MEMBER,
        [ITEM],
      );
      expect(result1.data[ITEM.id]).toEqual(sharedMembership);

      // other member cannot admin
      const { itemMemberships: result2 } = await validatePermissionMany(
        repositories,
        PermissionLevel.Admin,
        OTHER_MEMBER,
        [ITEM],
      );
      expect(result2.errors[0]).toBeInstanceOf(MemberCannotAccess);
    });
  });
});

describe('validatePermissionMany for many items', () => {
  let repositories;

  const SHARED_ITEM = { id: 'shared-item' } as Item;
  const PUBLIC_ITEM = { id: 'public-item' } as Item;

  afterEach(() => {
    jest.restoreAllMocks();
    getManyForManyMock.mockClear();
  });

  it('Public item & Shared write item', async () => {
    const sharedMembership = buildSharedMembership(PermissionLevel.Write, SHARED_ITEM);
    getManyForManyMock.mockImplementation(async () => ({
      data: { [PUBLIC_ITEM.id]: [MOCK_ITEM_VISIBILITY_PUBLIC], [SHARED_ITEM.id]: [] },
      errors: [],
    }));
    repositories = {
      itemMembershipRepository: {
        getInheritedMany: jest.fn(() => {
          return { data: { [SHARED_ITEM.id]: sharedMembership }, errors: [] };
        }),
      } as unknown as ItemMembershipRepository,
      itemVisibilityRepository,
    };
    // shared member can read both items
    const { itemMemberships: result } = await validatePermissionMany(
      repositories,
      PermissionLevel.Read,
      SHARED_MEMBER,
      [SHARED_ITEM, PUBLIC_ITEM],
    );
    expect(result.data[SHARED_ITEM.id]).toEqual(sharedMembership);
    expect(result.data[PUBLIC_ITEM.id]).toEqual(null);

    // shared member cannot write public item
    const { itemMemberships: result1 } = await validatePermissionMany(
      repositories,
      PermissionLevel.Write,
      SHARED_MEMBER,
      [SHARED_ITEM, PUBLIC_ITEM],
    );
    expect(result1.data[SHARED_ITEM.id]).toEqual(sharedMembership);
    expect(result1.data[PUBLIC_ITEM.id]).toBeUndefined();
    expect(result1.errors[0]).toBeInstanceOf(MemberCannotAccess);

    // shared member cannot admin
    const { itemMemberships: result2 } = await validatePermissionMany(
      repositories,
      PermissionLevel.Admin,
      SHARED_MEMBER,
      [SHARED_ITEM, PUBLIC_ITEM],
    );
    expect(result2.errors[0]).toBeInstanceOf(MemberCannotAdminItem);
    expect(result2.data[PUBLIC_ITEM.id]).toBeUndefined();
    expect(result2.errors[1]).toBeInstanceOf(MemberCannotAccess);
  });
});

describe('filterOutPackedDescendants', () => {
  let repositories;
  const item = FolderItemFactory() as unknown as Item;

  // raw descendants to pass to function
  const descendants = [
    FolderItemFactory({ parentItem: item }) as unknown as Item,
    FolderItemFactory({ parentItem: item }) as unknown as Item,
    FolderItemFactory({ parentItem: item }) as unknown as Item,
    FolderItemFactory({ parentItem: item }) as unknown as Item,
    FolderItemFactory({ parentItem: item }) as unknown as Item,
  ];
  const hiddenTag = { type: ItemVisibilityType.Hidden, item: descendants[2] } as ItemVisibility;

  /** build packed descendants for checking returned values
   * types don't play nicely because factory does not use the same types as the backend
   */
  const buildPackedDescendants = (permission, hiddenTag): PackedItem[] => {
    const arr = descendants.map((descendant) =>
      PackedFolderItemFactory(descendant as never, {
        permission,
      }),
    );
    const idx = arr.findIndex(({ id }) => id === hiddenTag.item.id);
    arr[idx].hidden = hiddenTag;
    return arr as unknown as PackedItem[];
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Admin returns all', async () => {
    // one parent membership
    const memberships = [{ item, member: OWNER, permission: PermissionLevel.Admin }];
    // packed descendants for expect
    // one item is hidden but this item should be returned
    const packedDescendants = buildPackedDescendants(memberships[0].permission, hiddenTag);

    repositories = {
      itemMembershipRepository: {
        getAllBelow: jest.fn(async () => memberships),
      },
      itemVisibilityRepository: {
        getManyBelowAndSelf: jest.fn(async () => [hiddenTag]),
      },
    };

    const result = await filterOutPackedDescendants(OWNER, repositories, item, descendants);

    expect(descendants).toHaveLength(result.length);
    for (let i = 0; i < result.length; i += 1) {
      expectPackedItem(packedDescendants[i], result[i]);
    }
  });

  it('Writer returns all', async () => {
    // one parent membership
    const memberships = [{ item, member: OWNER, permission: PermissionLevel.Write }];
    // packed descendants for expect
    // one item is hidden but this item should be returned
    const packedDescendants = buildPackedDescendants(memberships[0].permission, hiddenTag);

    repositories = {
      itemMembershipRepository: {
        getAllBelow: jest.fn(async () => memberships),
      },
      itemVisibilityRepository: {
        getManyBelowAndSelf: jest.fn(async () => [hiddenTag]),
      },
    };

    const result = await filterOutPackedDescendants(OWNER, repositories, item, descendants);

    expect(descendants).toHaveLength(result.length);
    for (let i = 0; i < result.length; i += 1) {
      expectPackedItem(packedDescendants[i], result[i]);
    }
  });

  it('Reader does not return hidden', async () => {
    // one parent membership
    const memberships = [{ item, member: OWNER, permission: PermissionLevel.Read }];
    // packed descendants for expect
    // one item is hidden, this item should not be returned!
    const packedDescendants = buildPackedDescendants(memberships[0].permission, hiddenTag);

    repositories = {
      itemMembershipRepository: {
        getAllBelow: jest.fn(async () => memberships),
      },
      itemVisibilityRepository: {
        getManyBelowAndSelf: jest.fn(async () => [hiddenTag]),
      },
    };

    const result = await filterOutPackedDescendants(OWNER, repositories, item, descendants);

    expect(result).toHaveLength(descendants.length - 1);
    result.forEach((r) => {
      const d = packedDescendants.find((i) => i.id === r.id);
      expectPackedItem(d, r);
    });
  });

  it('No membership does not return hidden', async () => {
    // packed descendants for expect
    // one item is hidden, this item should not be returned!
    const packedDescendants = buildPackedDescendants(null, hiddenTag);

    repositories = {
      itemMembershipRepository: {
        getAllBelow: jest.fn(async () => []),
      },
      itemVisibilityRepository: {
        getManyBelowAndSelf: jest.fn(async () => [hiddenTag]),
      },
    };

    const result = await filterOutPackedDescendants(OWNER, repositories, item, descendants);

    expect(result).toHaveLength(descendants.length - 1);
    result.forEach((r) => {
      const d = packedDescendants.find((i) => i.id === r.id);
      expectPackedItem(d, r);
    });
  });
});

describe('Passport Plugin', () => {
  let app: FastifyInstance;
  let member: Member;
  let handler: jest.Mock;
  let preHandler: jest.Mock;
  const MOCKED_ROUTE = '/mock-route';

  function shouldNotBeCalled() {
    return () => fail('Should not be called');
  }
  function shouldBeActor(actor: Member) {
    return ({ user }) => expect(user.account).toEqual(actor);
  }

  beforeAll(async () => {
    ({ app } = await build({ member: null }));

    handler = jest.fn();
    preHandler = jest.fn(async () => {});
    app.get(MOCKED_ROUTE, { preHandler: [isAuthenticated, preHandler] }, async (...args) =>
      handler(...args),
    );
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  beforeEach(async () => {
    const actor = await saveMember();
    mockAuthenticate(actor);
    member = asDefined(actor);
  });

  afterEach(async () => {
    unmockAuthenticate();
    handler.mockClear();
  });

  it('No Whitelist', async () => {
    handler.mockImplementation(shouldBeActor(member));
    const response = await app.inject({ path: MOCKED_ROUTE });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(StatusCodes.OK);
  });

  describe('Whitelist ValidatedMember Role', () => {
    beforeEach(async () => {
      preHandler.mockImplementation(matchOne(validatedMemberAccountRole));
    });

    it('Validated Member', async () => {
      handler.mockImplementation(shouldBeActor(member));
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });

    it('Unvalidated Member', async () => {
      member.isValidated = false;
      mockAuthenticate(member);
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
  });
});
