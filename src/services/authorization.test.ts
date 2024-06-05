import { ItemTagType, PermissionLevel } from '@graasp/sdk';

import { ItemMembershipRepository } from '../services/itemMembership/repository';
import { MemberCannotAccess, MemberCannotAdminItem, MemberCannotWriteItem } from '../utils/errors';
import { validatePermission, validatePermissionMany } from './authorization';
import { Item } from './item/entities/Item';
import { ItemTag } from './item/plugins/itemTag/ItemTag';
import { ItemTagRepository } from './item/plugins/itemTag/repository';
import { ItemMembership } from './itemMembership/entities/ItemMembership';
import { Member } from './member/entities/member';

const OWNER = { id: 'owner', name: 'owner' } as Member;
const SHARED_MEMBER = { id: 'shared', name: 'shared' } as Member;
const OTHER_MEMBER = { id: 'other', name: 'other' } as Member;
const ITEM = { id: 'item' } as Item;
const ownerMembership = { member: OWNER, permission: PermissionLevel.Admin } as ItemMembership;
const buildSharedMembership = (permission: PermissionLevel, item: Item = ITEM) =>
  ({ member: SHARED_MEMBER, permission, item } as ItemMembership);

jest.mock('./item/plugins/itemTag/repository');

const itemTagRepository = new ItemTagRepository();
const getManyForManyMock = jest.spyOn(itemTagRepository, 'getManyForMany');

const MOCK_ITEM_TAG_PUBLIC = { type: ItemTagType.Public } as ItemTag;
const MOCK_ITEM_TAG_HIDDEN = { type: ItemTagType.Hidden } as ItemTag;

describe('Authorization', () => {
  let repositories;

  beforeEach(() => {
    getManyForManyMock.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    getManyForManyMock.mockClear();
  });

  describe('validatePermission', () => {
    it('Invalid saved membership', async () => {
      jest.spyOn(itemTagRepository, 'getForItem').mockImplementation(async () => []);

      const repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn(() => ({ permission: 'anything' })),
        } as unknown as typeof ItemMembershipRepository,
        itemTagRepository,
      };

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM),
      ).rejects.toBeInstanceOf(Error);
    });

    describe('Private item', () => {
      beforeEach(() => {
        jest.spyOn(itemTagRepository, 'getForItem').mockImplementation(async () => []);
        repositories = {
          itemMembershipRepository: {
            getInherited: jest.fn((item, member) =>
              member.id === OWNER.id ? ownerMembership : null,
            ),
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
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

      jest.spyOn(itemTagRepository, 'getForItem').mockImplementation(async () => []);
      const repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn((item, member) => {
            switch (member.id) {
              case OWNER.id:
                return ownerMembership;
              case SHARED_MEMBER.id:
                return sharedMembership;
              default:
                return null;
            }
          }),
        } as unknown as typeof ItemMembershipRepository,
        itemTagRepository,
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

      jest.spyOn(itemTagRepository, 'getForItem').mockImplementation(async () => []);
      const repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn((item, member) => {
            switch (member.id) {
              case OWNER.id:
                return ownerMembership;
              case SHARED_MEMBER.id:
                return sharedMembership;
              default:
                return null;
            }
          }),
        } as unknown as typeof ItemMembershipRepository,
        itemTagRepository,
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

      jest.spyOn(itemTagRepository, 'getForItem').mockImplementation(async () => []);
      const repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn((item, member) => {
            switch (member.id) {
              case OWNER.id:
                return ownerMembership;
              case SHARED_MEMBER.id:
                return sharedMembership;
              default:
                return null;
            }
          }),
        } as unknown as typeof ItemMembershipRepository,
        itemTagRepository,
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
          .spyOn(itemTagRepository, 'getForItem')
          .mockImplementation(async () => [MOCK_ITEM_TAG_PUBLIC]);
        repositories = {
          itemMembershipRepository: {
            getInherited: jest.fn(async (item, member) => {
              switch (member.id) {
                case OWNER.id:
                  return ownerMembership;
                default:
                  return null;
              }
            }),
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
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
          .spyOn(itemTagRepository, 'getForItem')
          .mockImplementation(async () => [MOCK_ITEM_TAG_PUBLIC]);

        repositories = {
          itemMembershipRepository: {
            getInherited: jest.fn(async (item, member) => {
              switch (member.id) {
                case OWNER.id:
                  return ownerMembership;
                case SHARED_MEMBER.id:
                  return sharedMembership;
                default:
                  return null;
              }
            }),
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
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
          .spyOn(itemTagRepository, 'getForItem')
          .mockImplementation(async () => [MOCK_ITEM_TAG_PUBLIC]);

        repositories = {
          itemMembershipRepository: {
            getInherited: jest.fn(async (item, member) => {
              switch (member.id) {
                case OWNER.id:
                  return ownerMembership;
                case SHARED_MEMBER.id:
                  return sharedMembership;
                default:
                  return null;
              }
            }),
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
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
          .spyOn(itemTagRepository, 'getForItem')
          .mockImplementation(async () => [MOCK_ITEM_TAG_PUBLIC]);

        repositories = {
          itemMembershipRepository: {
            getInherited: jest.fn(async (item, member) => {
              switch (member.id) {
                case OWNER.id:
                  return ownerMembership;
                case SHARED_MEMBER.id:
                  return sharedMembership;
                default:
                  return null;
              }
            }),
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
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
          .spyOn(itemTagRepository, 'getForItem')
          .mockImplementation(async () => [MOCK_ITEM_TAG_HIDDEN]);

        repositories = {
          itemMembershipRepository: {
            getInherited: jest.fn(async (item, member) => {
              switch (member.id) {
                case OWNER.id:
                  return ownerMembership;
                case SHARED_MEMBER.id:
                  return sharedMembership;
                default:
                  return null;
              }
            }),
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
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
          .spyOn(itemTagRepository, 'getForItem')
          .mockImplementation(async () => [MOCK_ITEM_TAG_HIDDEN]);

        repositories = {
          itemMembershipRepository: {
            getInherited: jest.fn(async (item, member) => {
              switch (member.id) {
                case OWNER.id:
                  return ownerMembership;
                case SHARED_MEMBER.id:
                  return sharedMembership;
                default:
                  return null;
              }
            }),
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
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
          .spyOn(itemTagRepository, 'getForItem')
          .mockImplementation(async () => [MOCK_ITEM_TAG_HIDDEN]);

        repositories = {
          itemMembershipRepository: {
            getInherited: jest.fn(async (item, member) => {
              switch (member.id) {
                case OWNER.id:
                  return ownerMembership;
                case SHARED_MEMBER.id:
                  return sharedMembership;
                default:
                  return null;
              }
            }),
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
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
          .spyOn(itemTagRepository, 'getForItem')
          .mockImplementation(async () => [MOCK_ITEM_TAG_HIDDEN, MOCK_ITEM_TAG_PUBLIC]);

        repositories = {
          itemMembershipRepository: {
            getInherited: jest.fn(async (item, member) => {
              switch (member.id) {
                case OWNER.id:
                  return ownerMembership;
                default:
                  return null;
              }
            }),
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
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
        .spyOn(itemTagRepository, 'getForItem')
        .mockImplementation(async () => [MOCK_ITEM_TAG_HIDDEN, MOCK_ITEM_TAG_PUBLIC]);
      const repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn(async (item, member) => {
            switch (member.id) {
              case OWNER.id:
                return ownerMembership;
              case SHARED_MEMBER.id:
                return sharedMembership;
              default:
                return null;
            }
          }),
        } as unknown as typeof ItemMembershipRepository,
        itemTagRepository,
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
        .spyOn(itemTagRepository, 'getForItem')
        .mockImplementation(async () => [MOCK_ITEM_TAG_HIDDEN, MOCK_ITEM_TAG_PUBLIC]);
      const repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn(async (item, member) => {
            switch (member.id) {
              case OWNER.id:
                return ownerMembership;
              case SHARED_MEMBER.id:
                return sharedMembership;
              default:
                return null;
            }
          }),
        } as unknown as typeof ItemMembershipRepository,
        itemTagRepository,
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
        .spyOn(itemTagRepository, 'getForItem')
        .mockImplementation(async () => [MOCK_ITEM_TAG_HIDDEN, MOCK_ITEM_TAG_PUBLIC]);
      const repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn(async (item, member) => {
            switch (member.id) {
              case OWNER.id:
                return ownerMembership;
              case SHARED_MEMBER.id:
                return sharedMembership;
              default:
                return null;
            }
          }),
        } as unknown as typeof ItemMembershipRepository,
        itemTagRepository,
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

  describe('validatePermissionMany', () => {
    describe('no items', () => {
      it('Should return empty data', async () => {
        jest.spyOn(itemTagRepository, 'getForItem').mockImplementation(async () => []);
        const repositories = {
          itemMembershipRepository: {
            getInheritedMany: jest.fn(() => ({ permission: 'anything' })),
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
        };

        const res = await validatePermissionMany(repositories, PermissionLevel.Admin, OWNER, []);
        const expected: Awaited<ReturnType<typeof validatePermissionMany>> = {
          itemMemberships: { data: {}, errors: [] },
          tags: { data: {}, errors: [] },
        };
        // any other member shouldn't access
        expect(res).toEqual(expected);
        expect(repositories.itemMembershipRepository.getInheritedMany).not.toHaveBeenCalled();
        expect(repositories.itemTagRepository.getManyForMany).not.toHaveBeenCalled();
      });
    });

    describe('one item', () => {
      it('Invalid saved membership', async () => {
        jest.spyOn(itemTagRepository, 'getForItem').mockImplementation(async () => []);
        const repositories = {
          itemMembershipRepository: {
            getInheritedMany: jest.fn(() => ({ permission: 'anything' })),
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
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
              getInheritedMany: jest.fn((items, member) => {
                let im;

                switch (member.id) {
                  case OWNER.id:
                    im = ownerMembership;
                    break;

                  default:
                    break;
                }
                return { data: { [ITEM.id]: im }, errors: [] };
              }),
            } as unknown as typeof ItemMembershipRepository,
            itemTagRepository,
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
              getInheritedMany: jest.fn((items, member) => {
                let im;

                switch (member.id) {
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
            } as unknown as typeof ItemMembershipRepository,
            itemTagRepository,
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
              getInheritedMany: jest.fn((items, member) => {
                let im;

                switch (member.id) {
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
            } as unknown as typeof ItemMembershipRepository,
            itemTagRepository,
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
              getInheritedMany: jest.fn((items, member) => {
                let im;

                switch (member.id) {
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
            } as unknown as typeof ItemMembershipRepository,
            itemTagRepository,
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
            data: { [ITEM.id]: [MOCK_ITEM_TAG_PUBLIC] },
            errors: [],
          }));
          repositories = {
            itemMembershipRepository: {
              getInheritedMany: jest.fn((items, member) => {
                let im;

                switch (member.id) {
                  case OWNER.id:
                    im = ownerMembership;
                    break;

                  default:
                    break;
                }
                return { data: { [ITEM.id]: im }, errors: [] };
              }),
            } as unknown as typeof ItemMembershipRepository,
            itemTagRepository,
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
            data: { [ITEM.id]: [MOCK_ITEM_TAG_PUBLIC] },
            errors: [],
          }));

          repositories = {
            itemMembershipRepository: {
              getInheritedMany: jest.fn((items, member) => {
                let im;

                switch (member.id) {
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
            } as unknown as typeof ItemMembershipRepository,
            itemTagRepository,
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
          data: { [ITEM.id]: [MOCK_ITEM_TAG_PUBLIC] },
          errors: [],
        }));

        const repositories = {
          itemMembershipRepository: {
            getInheritedMany: jest.fn((items, member) => {
              let im;

              switch (member.id) {
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
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
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
            data: { [ITEM.id]: [MOCK_ITEM_TAG_PUBLIC] },
            errors: [],
          };
        });

        const repositories = {
          itemMembershipRepository: {
            getInheritedMany: jest.fn((items, member) => {
              let im;

              switch (member.id) {
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
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
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
            data: { [ITEM.id]: [MOCK_ITEM_TAG_HIDDEN] },
            errors: [],
          }));

          repositories = {
            itemMembershipRepository: {
              getInheritedMany: jest.fn((items, member) => {
                let im;

                switch (member.id) {
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
            } as unknown as typeof ItemMembershipRepository,
            itemTagRepository,
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
            data: { [ITEM.id]: [MOCK_ITEM_TAG_HIDDEN] },
            errors: [],
          }));

          repositories = {
            itemMembershipRepository: {
              getInheritedMany: jest.fn((items, member) => {
                let im;

                switch (member.id) {
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
            } as unknown as typeof ItemMembershipRepository,
            itemTagRepository,
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
            data: { [ITEM.id]: [MOCK_ITEM_TAG_HIDDEN] },
            errors: [],
          }));

          repositories = {
            itemMembershipRepository: {
              getInheritedMany: jest.fn((items, member) => {
                let im;

                switch (member.id) {
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
            } as unknown as typeof ItemMembershipRepository,
            itemTagRepository,
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
            data: { [ITEM.id]: [MOCK_ITEM_TAG_HIDDEN, MOCK_ITEM_TAG_PUBLIC] },
            errors: [],
          }));
          repositories = {
            itemMembershipRepository: {
              getInheritedMany: jest.fn((items, member) => {
                let im;

                switch (member.id) {
                  case OWNER.id:
                    im = ownerMembership;
                    break;

                  default:
                    break;
                }
                return { data: { [ITEM.id]: im }, errors: [] };
              }),
            } as unknown as typeof ItemMembershipRepository,
            itemTagRepository,
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
            data: { [ITEM.id]: [MOCK_ITEM_TAG_HIDDEN] },
            errors: [],
          }));
          repositories = {
            itemMembershipRepository: {
              getInheritedMany: jest.fn((items, member) => {
                let im;

                switch (member.id) {
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
            } as unknown as typeof ItemMembershipRepository,
            itemTagRepository,
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
            data: { [ITEM.id]: [MOCK_ITEM_TAG_HIDDEN] },
            errors: [],
          }));
          repositories = {
            itemMembershipRepository: {
              getInheritedMany: jest.fn((items, member) => {
                let im;

                switch (member.id) {
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
            } as unknown as typeof ItemMembershipRepository,
            itemTagRepository,
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
            data: { [ITEM.id]: [MOCK_ITEM_TAG_HIDDEN] },
            errors: [],
          }));
          repositories = {
            itemMembershipRepository: {
              getInheritedMany: jest.fn((items, member) => {
                let im;

                switch (member.id) {
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
            } as unknown as typeof ItemMembershipRepository,
            itemTagRepository,
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
    });

    describe('many items', () => {
      const SHARED_ITEM = { id: 'shared-item' } as Item;
      const PUBLIC_ITEM = { id: 'public-item' } as Item;

      it('Public item & Shared write item', async () => {
        const sharedMembership = buildSharedMembership(PermissionLevel.Write, SHARED_ITEM);
        getManyForManyMock.mockImplementation(async () => ({
          data: { [PUBLIC_ITEM.id]: [MOCK_ITEM_TAG_PUBLIC], [SHARED_ITEM.id]: [] },
          errors: [],
        }));
        repositories = {
          itemMembershipRepository: {
            getInheritedMany: jest.fn(() => {
              return { data: { [SHARED_ITEM.id]: sharedMembership }, errors: [] };
            }),
          } as unknown as typeof ItemMembershipRepository,
          itemTagRepository,
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
  });
});
