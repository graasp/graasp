import { StatusCodes } from 'http-status-codes';

import { FastifyInstance, PassportUser } from 'fastify';

import {
  FolderItemFactory,
  ItemVisibilityType,
  PackedFolderItemFactory,
  PermissionLevel,
} from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../test/app';
import {
  Account,
  Item,
  ItemMembershipRaw,
  ItemMembershipWithItemAndAccount,
  ItemVisibilityRaw,
} from '../drizzle/types';
import { ItemMembershipRepository } from '../services/itemMembership/repository';
import { MinimalMember } from '../types';
import { asDefined } from '../utils/assertions';
import { MemberCannotAccess, MemberCannotAdminItem, MemberCannotWriteItem } from '../utils/errors';
import { isAuthenticated } from './auth/plugins/passport';
import { matchOne } from './authorization';
import { PackedItem } from './item/ItemWrapper';
import { ItemVisibilityRepository } from './item/plugins/itemVisibility/repository';
import { expectPackedItem } from './item/test/fixtures/items';
import { validatedMemberAccountRole } from './member/strategies/validatedMemberAccountRole';
import { saveMember } from './member/test/fixtures/members';

const OWNER = { id: 'owner', name: 'owner' } as Account;
const SHARED_MEMBER = { id: 'shared', name: 'shared' } as Account;
const OTHER_MEMBER = { id: 'other', name: 'other' } as MinimalMember;
const ITEM = { id: 'item' } as Item;
const ownerMembership = {
  account: OWNER,
  permission: PermissionLevel.Admin,
} as ItemMembershipRaw;
const buildSharedMembership = (permission: PermissionLevel, item: Item = ITEM) =>
  ({ account: SHARED_MEMBER, permission, item }) as ItemMembershipWithItemAndAccount;

jest.mock('./item/plugins/itemVisibility/repository');

const itemVisibilityRepository = new ItemVisibilityRepository();
const getManyForManyMock = jest.spyOn(itemVisibilityRepository, 'getManyForMany');

const MOCK_ITEM_VISIBILITY_PUBLIC = {
  type: ItemVisibilityType.Public,
} as ItemVisibilityRaw;
const MOCK_ITEM_VISIBILITY_HIDDEN = {
  type: ItemVisibilityType.Hidden,
} as ItemVisibilityRaw;
const returnDummyArray = async () => [];

// TODO: Update suite to test the Authorization service which was added to convert the single functions we had previously
describe('validatePermission', () => {
  let repositories: {
    itemMembershipRepository: ItemMembershipRepository;
    itemVisibilityRepository: ItemVisibilityRepository;
  };

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
  let repositories: {
    itemMembershipRepository: ItemMembershipRepository;
    itemVisibilityRepository: ItemVisibilityRepository;
  };

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
        data: {
          [ITEM.id]: [MOCK_ITEM_VISIBILITY_HIDDEN, MOCK_ITEM_VISIBILITY_PUBLIC],
        },
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
      data: {
        [PUBLIC_ITEM.id]: [MOCK_ITEM_VISIBILITY_PUBLIC],
        [SHARED_ITEM.id]: [],
      },
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

describe('Passport Plugin', () => {
  let app: FastifyInstance;
  let member: MinimalMember;
  let handler: jest.Mock;
  let preHandler: jest.Mock;
  const MOCKED_ROUTE = '/mock-route';

  function shouldNotBeCalled() {
    return () => fail('Should not be called');
  }
  function shouldBeActor(actor: MinimalMember) {
    return ({ user }: { user: PassportUser }) => expect(user.account).toEqual(actor);
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

    it('Validated MinimalMember', async () => {
      handler.mockImplementation(shouldBeActor(member));
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
    });

    it('Unvalidated MinimalMember', async () => {
      member.isValidated = false;
      mockAuthenticate(member);
      handler.mockImplementation(shouldNotBeCalled);
      const response = await app.inject({ path: MOCKED_ROUTE });
      expect(handler).toHaveBeenCalledTimes(0);
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
  });
});
