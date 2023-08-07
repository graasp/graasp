import { ItemTagType, PermissionLevel } from '@graasp/sdk';

import { ItemMembershipRepository } from '../services/itemMembership/repository';
import {
  MemberCannotAccess,
  MemberCannotAdminItem,
  MemberCannotReadItem,
  MemberCannotWriteItem,
} from '../utils/errors';
import { validatePermission } from './authorization';
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
const buildSharedMembership = (permission: PermissionLevel) =>
  ({ member: SHARED_MEMBER, permission } as ItemMembership);

describe('Authorization', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validatePermission', () => {
    it('Invalid saved membership', async () => {
      const repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn((item, member) => ({ permission: 'anything' })),
        } as unknown as typeof ItemMembershipRepository,
        itemTagRepository: {
          hasMany: jest.fn(() => ({ data: {}, errors: [] })),
        } as unknown as typeof ItemTagRepository,
      };

      // any other member shouldn't access
      await expect(
        validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM),
      ).rejects.toBeInstanceOf(Error);
    });

    describe('Private item', () => {
      const repositories = {
        itemMembershipRepository: {
          getInherited: jest.fn((item, member) =>
            member.id === OWNER.id ? ownerMembership : null,
          ),
        } as unknown as typeof ItemMembershipRepository,
        itemTagRepository: {
          hasMany: jest.fn(() => ({ data: {}, errors: [] })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // any other member shouldn't access
        await expect(
          validatePermission(repositories, PermissionLevel.Read, OTHER_MEMBER, ITEM),
        ).rejects.toBeInstanceOf(MemberCannotAccess);
      });
      it(PermissionLevel.Write, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // any other member shouldn't access
        await expect(
          validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
        ).rejects.toBeInstanceOf(MemberCannotAccess);
      });
      it(PermissionLevel.Admin, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // any other member shouldn't access
        await expect(
          validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
        ).rejects.toBeInstanceOf(MemberCannotAccess);
      });
    });
    describe('Shared item with Read permission', () => {
      const sharedMembership = buildSharedMembership(PermissionLevel.Read);
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
        itemTagRepository: {
          hasMany: jest.fn(() => ({ data: {}, errors: [] })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can read
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
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
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
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
        itemTagRepository: {
          hasMany: jest.fn(() => ({ data: {}, errors: [] })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can read
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can write
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
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
        itemTagRepository: {
          hasMany: jest.fn(() => ({ data: {}, errors: [] })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can read
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can write
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can admin
        const result1 = await validatePermission(
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
      const repositories = {
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
        itemTagRepository: {
          hasMany: jest.fn(async () => ({
            data: { [ItemTagType.Public]: true },
            errors: [],
          })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // other member can read
        const result1 = await validatePermission(
          repositories,
          PermissionLevel.Read,
          OTHER_MEMBER,
          ITEM,
        );
        expect(result1).toEqual(null);
      });
      it(PermissionLevel.Write, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // any other member shouldn't access
        await expect(
          validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
        ).rejects.toBeInstanceOf(MemberCannotAccess);
      });
      it(PermissionLevel.Admin, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // any other member shouldn't access
        await expect(
          validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
        ).rejects.toBeInstanceOf(MemberCannotAccess);
      });
    });
    describe('Public item with shared read permission', () => {
      const sharedMembership = buildSharedMembership(PermissionLevel.Read);
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
        itemTagRepository: {
          hasMany: jest.fn(async () => ({
            data: { [ItemTagType.Public]: true },
            errors: [],
          })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can read
        const result1 = await validatePermission(
          repositories,
          PermissionLevel.Read,
          SHARED_MEMBER,
          ITEM,
        );
        expect(result1).toEqual(sharedMembership);

        // other member can read
        const result2 = await validatePermission(
          repositories,
          PermissionLevel.Read,
          OTHER_MEMBER,
          ITEM,
        );
        expect(result2).toEqual(null);
      });
      it(PermissionLevel.Write, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
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
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
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
        itemTagRepository: {
          hasMany: jest.fn(async () => ({
            data: { [ItemTagType.Public]: true },
            errors: [],
          })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can read
        const result1 = await validatePermission(
          repositories,
          PermissionLevel.Read,
          SHARED_MEMBER,
          ITEM,
        );
        expect(result1).toEqual(sharedMembership);

        // other member can read
        const result2 = await validatePermission(
          repositories,
          PermissionLevel.Read,
          OTHER_MEMBER,
          ITEM,
        );
        expect(result2).toEqual(null);
      });
      it(PermissionLevel.Write, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can write
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
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
        itemTagRepository: {
          hasMany: jest.fn(async () => ({
            data: { [ItemTagType.Public]: true },
            errors: [],
          })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can read
        const result1 = await validatePermission(
          repositories,
          PermissionLevel.Read,
          SHARED_MEMBER,
          ITEM,
        );
        expect(result1).toEqual(sharedMembership);

        // other member can read
        const result2 = await validatePermission(
          repositories,
          PermissionLevel.Read,
          OTHER_MEMBER,
          ITEM,
        );
        expect(result2).toEqual(null);
      });
      it(PermissionLevel.Write, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can write
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can admin
        const result1 = await validatePermission(
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
        itemTagRepository: {
          hasMany: jest.fn(async () => ({
            data: { [ItemTagType.Hidden]: true },
            errors: [],
          })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
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
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
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
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
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
        itemTagRepository: {
          hasMany: jest.fn(async () => ({
            data: { [ItemTagType.Hidden]: true },
            errors: [],
          })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can read
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can write
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
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
        itemTagRepository: {
          hasMany: jest.fn(async () => ({
            data: { [ItemTagType.Hidden]: true },
            errors: [],
          })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can read
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can write
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member can admin
        const result1 = await validatePermission(
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
      const repositories = {
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
        itemTagRepository: {
          hasMany: jest.fn(async () => ({
            data: { [ItemTagType.Public]: true, [ItemTagType.Hidden]: true },
            errors: [],
          })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // any other member shouldn't access
        await expect(
          validatePermission(repositories, PermissionLevel.Read, OTHER_MEMBER, ITEM),
        ).rejects.toBeInstanceOf(MemberCannotAccess);
      });
      it(PermissionLevel.Write, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // any other member shouldn't access
        await expect(
          validatePermission(repositories, PermissionLevel.Write, OTHER_MEMBER, ITEM),
        ).rejects.toBeInstanceOf(MemberCannotAccess);
      });
      it(PermissionLevel.Admin, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // any other member shouldn't access
        await expect(
          validatePermission(repositories, PermissionLevel.Admin, OTHER_MEMBER, ITEM),
        ).rejects.toBeInstanceOf(MemberCannotAccess);
      });
    });
    describe('Public & Hidden item with shared read permission', () => {
      const sharedMembership = buildSharedMembership(PermissionLevel.Read);
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
        itemTagRepository: {
          hasMany: jest.fn(async () => ({
            data: { [ItemTagType.Public]: true, [ItemTagType.Hidden]: true },
            errors: [],
          })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
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
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
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
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
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
        itemTagRepository: {
          hasMany: jest.fn(async () => ({
            data: { [ItemTagType.Public]: true, [ItemTagType.Hidden]: true },
            errors: [],
          })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member should pass
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member should pass
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
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
        itemTagRepository: {
          hasMany: jest.fn(async () => ({
            data: { [ItemTagType.Public]: true, [ItemTagType.Hidden]: true },
            errors: [],
          })),
        } as unknown as typeof ItemTagRepository,
      };

      it(PermissionLevel.Read, async () => {
        // owner should pass
        const result = await validatePermission(repositories, PermissionLevel.Read, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member should pass
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Write, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member should pass
        const result1 = await validatePermission(
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
        const result = await validatePermission(repositories, PermissionLevel.Admin, OWNER, ITEM);
        expect(result).toEqual(ownerMembership);

        // shared member should pass
        const result1 = await validatePermission(
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
});
