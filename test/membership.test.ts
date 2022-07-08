import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import { HttpMethod, PermissionLevel } from '@graasp/sdk';

import { MAX_ITEM_MEMBERSHIPS_FOR_DELETE } from '../src/util/config';
import {
  InvalidMembership,
  InvalidPermissionLevel,
  ItemMembershipNotFound,
  ItemNotFound,
  MemberCannotAccess,
  MemberCannotAdminItem,
  MemberCannotReadItem,
  ModifyExisting,
  TooManyMemberships,
} from '../src/util/graasp-error';
import build from './app';
import { getDummyItem } from './fixtures/items';
import * as MEMBERS_FIXTURES from './fixtures/members';
import { buildMembership } from './fixtures/memberships';
import {
  mockItemMemberhipServiceDelete,
  mockItemMemberhipServiceGet,
  mockItemMemberhipServiceGetAllBelow,
  mockItemMemberhipServiceGetInherited,
  mockItemMemberhipServiceGetInheritedForAll,
  mockItemMembershipServiceCreate,
  mockItemMembershipServiceGetAllInSubtree,
  mockItemMembershipServiceGetForMemberAtItem,
  mockItemMembershipServiceUpdate,
  mockItemServiceGet,
  mockItemServiceGetMatchingPath,
  mockMemberServiceGet,
} from './mocks';

// mock auth, decorator and database plugins
jest.mock('../src/plugins/database');
jest.mock('../src/plugins/auth/auth');
jest.mock('../src/plugins/decorator');

describe('Membership routes tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /item-memberships?itemId=<itemId>', () => {
    it('Returns successfully for one id', async () => {
      const item = getDummyItem();
      const memberships = [buildMembership({ permission: PermissionLevel.Read, path: item.path })];
      mockItemServiceGet([item]);
      mockItemMemberhipServiceGetInheritedForAll(memberships);
      const app = await build();

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/item-memberships?itemId=${item.id}`,
      });

      expect(response.json()).toEqual([memberships]);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Returns successfully for two ids', async () => {
      const item1 = getDummyItem();
      const item2 = getDummyItem();
      const memberships = [
        buildMembership({ permission: PermissionLevel.Read, path: item1.path }),
        buildMembership({ permission: PermissionLevel.Read, path: item2.path }),
      ];
      mockItemServiceGet([item1, item2]);
      mockItemMemberhipServiceGetInheritedForAll(memberships);
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/item-memberships?itemId=${item1.id}&itemId=${item2.id}`,
      });
      const m = response.json();
      expect(m[0]).toEqual([memberships[0]]);
      expect(m[1]).toEqual([memberships[1]]);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Bad request for invalid id', async () => {
      const app = await build();

      const response = await app.inject({
        method: HttpMethod.GET,
        url: '/item-memberships?itemId=invalid-id',
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Item not found for missing item', async () => {
      const app = await build();
      const itemId = getDummyItem().id;
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/item-memberships?itemId=${itemId}`,
      });
      expect(response.json()).toEqual([new ItemNotFound(itemId)]);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Cannot get memberships if user has no membership', async () => {
      const item = getDummyItem();
      mockItemServiceGet([item]);
      const app = await build();

      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/item-memberships?itemId=${item.id}`,
      });

      expect(response.json()).toEqual([new MemberCannotReadItem(item.id)]);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
  });

  describe('POST /item-memberships', () => {
    it('Create new membership successfully', async () => {
      const item = getDummyItem();
      const memberships = [buildMembership({ permission: PermissionLevel.Admin, path: item.path })];
      const member = MEMBERS_FIXTURES.BOB;
      const newMembership = buildMembership({
        permission: PermissionLevel.Write,
        path: item.path,
        memberId: member.id,
      });
      mockItemServiceGet([item]);
      mockItemMemberhipServiceGetInheritedForAll(memberships);
      const mockCreate = mockItemMembershipServiceCreate();
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockMemberServiceGet([member]);
      const app = await build();

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/item-memberships?itemId=${item.id}`,
        payload: newMembership,
      });

      const m = response.json();
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(m.creator).toEqual(MEMBERS_FIXTURES.ACTOR.id);
      expect(m.permission).toEqual(newMembership.permission);
      expect(m.memberId).toEqual(newMembership.memberId);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Delete successfully memberships lower in the tree ', async () => {
      const item = getDummyItem();
      const childItem = getDummyItem({ parentPath: item.path });
      const childChildItem = getDummyItem({ parentPath: childItem.path });
      const memberships = [buildMembership({ permission: PermissionLevel.Admin, path: item.path })];
      const member = MEMBERS_FIXTURES.BOB;
      const newMembership = buildMembership({
        permission: PermissionLevel.Write,
        path: item.path,
        memberId: member.id,
      });
      const lowerMemberships = [
        buildMembership({
          path: childItem.path,
          permission: PermissionLevel.Read,
          memberId: MEMBERS_FIXTURES.BOB.id,
        }),
        buildMembership({
          path: childChildItem.path,
          permission: PermissionLevel.Read,
          memberId: MEMBERS_FIXTURES.BOB.id,
        }),
      ];
      mockItemServiceGet([item]);
      mockItemMemberhipServiceGetInheritedForAll(memberships);
      mockItemMembershipServiceCreate();
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockMemberServiceGet([member]);
      mockItemMemberhipServiceGetAllBelow(lowerMemberships);
      const mockDelete = mockItemMemberhipServiceDelete(memberships);
      const app = await build();

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/item-memberships?itemId=${item.id}`,
        payload: newMembership,
      });

      expect(mockDelete).toHaveBeenCalledTimes(lowerMemberships.length);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Cannot add new membership at same item for same member', async () => {
      const item = getDummyItem();
      const member = MEMBERS_FIXTURES.BOB;
      const newMembership = buildMembership({
        permission: PermissionLevel.Read,
        path: item.path,
        memberId: member.id,
      });
      const memberships = [
        buildMembership({ permission: PermissionLevel.Admin, path: item.path }),
        newMembership,
      ];
      mockItemServiceGet([item]);
      mockItemMemberhipServiceGetInheritedForAll(memberships);
      mockItemMemberhipServiceGetInherited(memberships[0]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockMemberServiceGet([member]);
      const app = await build();

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/item-memberships?itemId=${item.id}`,
        payload: newMembership,
      });

      expect(response.json()).toEqual(new ModifyExisting(memberships[0].id));
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Cannot set lower permission than inherited permission', async () => {
      const parentItem = getDummyItem();
      const item = getDummyItem({ parentPath: parentItem.path });
      const member = MEMBERS_FIXTURES.BOB;
      const memberMembership = buildMembership({
        permission: PermissionLevel.Read,
        path: parentItem.path,
        memberId: member.id,
      });

      const memberships = [
        // actor memberships
        buildMembership({ permission: PermissionLevel.Admin, path: item.path }),
        buildMembership({ permission: PermissionLevel.Admin, path: parentItem.path }),
        // member's membership on parent
        memberMembership,
      ];
      const newMembership = buildMembership({
        permission: PermissionLevel.Read,
        path: item.path,
        memberId: member.id,
      });
      mockItemServiceGet([item]);
      mockItemMemberhipServiceGetInheritedForAll(memberships);
      mockItemMemberhipServiceGetInherited(memberMembership);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockMemberServiceGet([member]);

      const app = await build();

      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/item-memberships?itemId=${item.id}`,
        payload: newMembership,
      });

      expect(response.json()).toEqual(
        new InvalidMembership({
          memberId: newMembership.memberId,
          permission: newMembership.permission,
        }),
      );
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Bad Request for invalid id', async () => {
      const item = getDummyItem();
      const member = MEMBERS_FIXTURES.BOB;
      const newMembership = buildMembership({
        permission: PermissionLevel.Read,
        path: item.path,
        memberId: member.id,
      });

      const app = await build();
      const id = 'invalid-id';
      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/item-memberships?itemId=${id}`,
        payload: newMembership,
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Bad Request for invalid payload', async () => {
      const item = getDummyItem();
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/item-memberships?itemId=${item.id}`,
        payload: {
          path: item.path,
          // missing permission
        },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
  });

  describe('POST many /item-memberships/itemId', () => {
    it('Create new memberships successfully', async () => {
      const item = getDummyItem();
      const memberships = [buildMembership({ permission: PermissionLevel.Admin, path: item.path })];
      const member1 = MEMBERS_FIXTURES.BOB;
      const member2 = MEMBERS_FIXTURES.LOUISA;
      const newMemberships = [
        buildMembership({
          permission: PermissionLevel.Write,
          path: item.path,
          memberId: member1.id,
        }),
        buildMembership({
          permission: PermissionLevel.Write,
          path: item.path,
          memberId: member2.id,
        }),
      ];
      mockItemServiceGet([item]);
      mockItemMemberhipServiceGetInheritedForAll(memberships);
      const mockCreate = mockItemMembershipServiceCreate();
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockMemberServiceGet([member1, member2]);
      const app = await build();

      const response = await app.inject({
        method: HTTP_METHODS.POST,
        url: `/item-memberships/${item.id}`,
        payload: { memberships: newMemberships },
      });

      const result = response.json();
      expect(mockCreate).toHaveBeenCalledTimes(newMemberships.length);
      result.forEach((m, idx) => {
        expect(m.creator).toEqual(MEMBERS_FIXTURES.ACTOR.id);
        expect(m.permission).toEqual(newMemberships[idx].permission);
        expect(m.memberId).toEqual(newMemberships[idx].memberId);
      });
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });

    it('Bad Request for invalid id', async () => {
      const item = getDummyItem();
      const member = MEMBERS_FIXTURES.BOB;
      const newMembership = [
        buildMembership({
          permission: PermissionLevel.Read,
          path: item.path,
          memberId: member.id,
        }),
      ];

      const app = await build();
      const id = 'invalid-id';
      const response = await app.inject({
        method: HTTP_METHODS.POST,
        url: `/item-memberships/${id}`,
        payload: { memberships: newMembership },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });

    it('Return error array for invalid payload', async () => {
      const item = getDummyItem();
      const member1 = MEMBERS_FIXTURES.BOB;
      mockItemServiceGet([item]);
      const memberships = [buildMembership({ permission: PermissionLevel.Admin, path: item.path })];
      mockItemMemberhipServiceGetInheritedForAll(memberships);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockMemberServiceGet([member1]);

      const app = await build();
      const response = await app.inject({
        method: HTTP_METHODS.POST,
        url: `/item-memberships/${item.id}`,
        payload: {
          memberships: [
            {
              email: member1.id,
              path: item.path,
              // missing permission
            },
          ],
        },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
  });

  describe('PATCH /item-memberships/:id', () => {
    it('Downgrade successfully', async () => {
      const parentItem = getDummyItem();
      const item = getDummyItem({ parentPath: parentItem.path });
      const member = MEMBERS_FIXTURES.BOB;
      const memberships = [
        buildMembership({ permission: PermissionLevel.Admin, path: item.path }),
        buildMembership({
          permission: PermissionLevel.Read,
          path: parentItem.path,
          memberId: member.id,
          creator: MEMBERS_FIXTURES.ACTOR.id,
        }),
        buildMembership({
          permission: PermissionLevel.Write,
          path: item.path,
          memberId: member.id,
          creator: MEMBERS_FIXTURES.ACTOR.id,
        }),
      ];
      const newMembership = buildMembership({
        permission: PermissionLevel.Read,
        path: item.path,
        memberId: member.id,
      });
      mockItemMemberhipServiceGet(memberships);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetMatchingPath([item, parentItem]);
      mockItemMembershipServiceUpdate(memberships);
      mockItemMemberhipServiceGetInherited();
      //   const mockDelete = mockItemMemberhipServiceDelete(memberships)

      const app = await build();
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/item-memberships/${memberships[1].id}`,
        payload: newMembership,
      });

      const m = response.json();
      //   expect(mockDelete).toHaveBeenCalledTimes(1)
      expect(m.creator).toEqual(MEMBERS_FIXTURES.ACTOR.id);
      expect(m.permission).toEqual(newMembership.permission);
      expect(m.memberId).toEqual(newMembership.memberId);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Downgrading membership removes itself thanks to inherited membership', async () => {
      const parentItem = getDummyItem();
      const item = getDummyItem({ parentPath: parentItem.path });
      const member = MEMBERS_FIXTURES.BOB;
      const memberships = [
        buildMembership({ permission: PermissionLevel.Admin, path: item.path }),
        buildMembership({
          permission: PermissionLevel.Read,
          path: parentItem.path,
          memberId: member.id,
          creator: MEMBERS_FIXTURES.ACTOR.id,
        }),
        buildMembership({
          permission: PermissionLevel.Write,
          path: item.path,
          memberId: member.id,
          creator: MEMBERS_FIXTURES.ACTOR.id,
        }),
      ];
      const newMembership = buildMembership({
        permission: PermissionLevel.Read,
        path: item.path,
        memberId: member.id,
      });
      mockItemMemberhipServiceGet(memberships);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetMatchingPath([item, parentItem]);
      mockItemMembershipServiceUpdate(memberships);
      mockItemMemberhipServiceGetInherited(memberships[1]);
      const mockDelete = mockItemMemberhipServiceDelete(memberships);

      const app = await build();
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/item-memberships/${memberships[1].id}`,
        payload: newMembership,
      });

      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Upgrade successfully', async () => {
      const item = getDummyItem();
      const member = MEMBERS_FIXTURES.BOB;
      const memberships = [
        buildMembership({ permission: PermissionLevel.Admin, path: item.path }),
        buildMembership({
          permission: PermissionLevel.Write,
          path: item.path,
          memberId: member.id,
          creator: MEMBERS_FIXTURES.ACTOR.id,
        }),
      ];
      const newMembership = buildMembership({
        permission: PermissionLevel.Admin,
        path: item.path,
        memberId: member.id,
      });
      mockItemMemberhipServiceGetInheritedForAll(memberships);
      mockItemMemberhipServiceGet(memberships);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetMatchingPath([item]);
      mockItemMembershipServiceUpdate(memberships);

      const app = await build();

      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/item-memberships/${memberships[1].id}`,
        payload: newMembership,
      });

      const m = response.json();

      expect(m.creator).toEqual(MEMBERS_FIXTURES.ACTOR.id);
      expect(m.permission).toEqual(newMembership.permission);
      expect(m.memberId).toEqual(newMembership.memberId);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });

    it('Delete successfully memberships lower in the tree', async () => {
      const item = getDummyItem();
      const childItem = getDummyItem({ parentPath: item.path });
      const childChildItem = getDummyItem({ parentPath: childItem.path });
      const member = MEMBERS_FIXTURES.BOB;
      const memberships = [
        buildMembership({ permission: PermissionLevel.Admin, path: item.path }),
        buildMembership({
          permission: PermissionLevel.Write,
          path: item.path,
          memberId: member.id,
          creator: MEMBERS_FIXTURES.ACTOR.id,
        }),
      ];
      const newMembership = buildMembership({
        permission: PermissionLevel.Read,
        path: item.path,
        memberId: member.id,
      });
      const lowerMemberships = [
        buildMembership({
          path: childItem.path,
          permission: PermissionLevel.Read,
          memberId: MEMBERS_FIXTURES.BOB.id,
        }),
        buildMembership({
          path: childChildItem.path,
          permission: PermissionLevel.Read,
          memberId: MEMBERS_FIXTURES.BOB.id,
        }),
      ];
      mockItemMemberhipServiceGet(memberships);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemServiceGetMatchingPath([item]);
      mockItemMembershipServiceUpdate(memberships);

      mockItemServiceGet([item]);
      mockItemMemberhipServiceGetInheritedForAll(memberships);
      mockMemberServiceGet([member]);
      mockItemMemberhipServiceGetInherited();

      mockItemMemberhipServiceGetAllBelow(lowerMemberships);
      const mockDelete = mockItemMemberhipServiceDelete(memberships);

      const app = await build();

      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/item-memberships/${memberships[1].id}`,
        payload: newMembership,
      });
      expect(mockDelete).toHaveBeenCalledTimes(lowerMemberships.length);
      expect(response.statusCode).toBe(StatusCodes.OK);
      app.close();
    });
    it('Bad request if payload is invalid', async () => {
      const item = getDummyItem();
      const member = MEMBERS_FIXTURES.BOB;
      const newMembership = buildMembership({
        permission: PermissionLevel.Read,
        path: item.path,
        memberId: member.id,
      });
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/item-memberships/${newMembership.id}`,
        payload: { permission: 'permission' },
      });

      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      app.close();
    });
    it('Bad request if id is invalid', async () => {
      const item = getDummyItem();
      const member = MEMBERS_FIXTURES.BOB;
      const newMembership = buildMembership({
        permission: PermissionLevel.Read,
        path: item.path,
        memberId: member.id,
      });
      const app = await build();
      const id = 'invalid-id';
      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/item-memberships/${id}`,
        payload: newMembership,
      });

      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      app.close();
    });
    it('Cannot set lower permission than inherited permission', async () => {
      const parentItem = getDummyItem();
      const item = getDummyItem({ parentPath: parentItem.path });
      const member = MEMBERS_FIXTURES.BOB;
      const memberMembership = buildMembership({
        permission: PermissionLevel.Write,
        path: parentItem.path,
        memberId: member.id,
      });

      const memberships = [
        // actor memberships
        buildMembership({ permission: PermissionLevel.Admin, path: item.path }),
        buildMembership({ permission: PermissionLevel.Admin, path: parentItem.path }),
        // member's membership on parent
        memberMembership,
      ];
      const newMembership = buildMembership({
        permission: PermissionLevel.Read,
        path: item.path,
        memberId: member.id,
      });
      mockItemServiceGet([parentItem, item]);
      mockItemMemberhipServiceGet(memberships);
      mockItemServiceGetMatchingPath([parentItem, item]);
      mockItemMembershipServiceUpdate(memberships);
      mockItemMemberhipServiceGetInheritedForAll(memberships);
      mockItemMemberhipServiceGetInherited(memberMembership);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockMemberServiceGet([member]);
      const app = await build();

      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/item-memberships/${memberMembership.id}`,
        payload: newMembership,
      });

      expect(response.json()).toEqual(new InvalidPermissionLevel(memberMembership.id));
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });
  });
  describe('DELETE /item-memberships/:id?purgeBelow=<boolean>', () => {
    it('Delete successfully', async () => {
      const item = getDummyItem();
      const member = MEMBERS_FIXTURES.BOB;
      const memberMembership = buildMembership({
        permission: PermissionLevel.Write,
        path: item.path,
        memberId: member.id,
        creator: MEMBERS_FIXTURES.ACTOR.id,
      });
      const memberships = [
        buildMembership({ permission: PermissionLevel.Admin, path: item.path }),
        memberMembership,
      ];
      const app = await build();

      mockItemServiceGetMatchingPath([item]);
      mockItemMemberhipServiceGet(memberships);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemMembershipServiceGetAllInSubtree(memberships);
      mockItemMemberhipServiceDelete(memberships);

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships/${memberMembership.id}`,
      });

      const m = response.json();
      expect(m.creator).toEqual(MEMBERS_FIXTURES.ACTOR.id);
      expect(m.permission).toEqual(memberMembership.permission);
      expect(m.memberId).toEqual(memberMembership.memberId);
      expect(response.statusCode).toEqual(StatusCodes.OK);
      app.close();
    });
    it('Delete successfully with purgeBelow=true', async () => {
      const item = getDummyItem();
      const member = MEMBERS_FIXTURES.BOB;
      const memberMembership = buildMembership({
        permission: PermissionLevel.Write,
        path: item.path,
        memberId: member.id,
        creator: MEMBERS_FIXTURES.ACTOR.id,
      });
      const memberships = [
        buildMembership({ permission: PermissionLevel.Admin, path: item.path }),
        memberMembership,
      ];
      const app = await build();

      mockItemServiceGetMatchingPath([item]);
      mockItemMemberhipServiceGet(memberships);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemMembershipServiceGetAllInSubtree(memberships);
      mockItemMemberhipServiceGetAllBelow(memberships);
      const mockDelete = mockItemMemberhipServiceDelete(memberships);

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships/${memberMembership.id}?purgeBelow=true`,
      });

      expect(mockDelete).toHaveBeenCalledTimes(memberships.length + 1);
      expect(response.statusCode).toEqual(StatusCodes.OK);
      app.close();
    });
    it('Bad request if id is invalid', async () => {
      const app = await build();
      const id = 'invalid-id';
      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships/${id}`,
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      app.close();
    });
    it('Cannot delete membership if does not exist', async () => {
      const item = getDummyItem();
      const member = MEMBERS_FIXTURES.BOB;
      const memberMembership = buildMembership({
        permission: PermissionLevel.Write,
        path: item.path,
        memberId: member.id,
      });
      const app = await build();

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships/${memberMembership.id}`,
      });

      expect(response.json()).toEqual(new ItemMembershipNotFound(memberMembership.id));
      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      app.close();
    });
    it('Cannot delete membership if can only read', async () => {
      const item = getDummyItem();
      const member = MEMBERS_FIXTURES.BOB;
      const memberMembership = buildMembership({
        permission: PermissionLevel.Read,
        path: item.path,
        memberId: member.id,
      });
      const memberships = [
        buildMembership({ permission: PermissionLevel.Read, path: item.path }),
        memberMembership,
      ];
      const app = await build();

      mockItemServiceGetMatchingPath([item]);
      mockItemMemberhipServiceGet(memberships);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemMembershipServiceGetAllInSubtree(memberships);

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships/${memberMembership.id}`,
      });

      expect(response.json()).toEqual(new MemberCannotAdminItem(item.id));
      expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
      app.close();
    });
    it('Cannot delete membership if can only write', async () => {
      const item = getDummyItem();
      const member = MEMBERS_FIXTURES.BOB;
      const memberMembership = buildMembership({
        permission: PermissionLevel.Write,
        path: item.path,
        memberId: member.id,
      });
      const memberships = [
        buildMembership({ permission: PermissionLevel.Read, path: item.path }),
        memberMembership,
      ];
      const app = await build();

      mockItemServiceGetMatchingPath([item]);
      mockItemMemberhipServiceGet(memberships);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemMembershipServiceGetAllInSubtree(memberships);

      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships/${memberMembership.id}`,
      });

      expect(response.json()).toEqual(new MemberCannotAdminItem(item.id));
      expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
      app.close();
    });
  });
  describe('DELETE /item-memberships?itemId=<id>', () => {
    it('Delete all successfully', async () => {
      const item = getDummyItem();
      const member = MEMBERS_FIXTURES.BOB;
      const memberships = [
        buildMembership({ permission: PermissionLevel.Admin, path: item.path }),
        buildMembership({
          permission: PermissionLevel.Write,
          path: item.path,
          memberId: member.id,
          creator: MEMBERS_FIXTURES.ACTOR.id,
        }),
        buildMembership({
          permission: PermissionLevel.Write,
          path: item.path,
          memberId: MEMBERS_FIXTURES.ANNA.id,
          creator: MEMBERS_FIXTURES.ACTOR.id,
        }),
      ];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemMembershipServiceGetAllInSubtree(memberships);
      const mockDelete = mockItemMemberhipServiceDelete(memberships);

      const app = await build();
      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships?itemId=${item.id}`,
      });

      // delete all memberships except author's
      expect(mockDelete).toHaveBeenCalledTimes(
        memberships.filter(({ memberId }) => memberId !== MEMBERS_FIXTURES.ACTOR.id).length,
      );
      expect(response.statusCode).toBe(StatusCodes.NO_CONTENT);
      app.close();
    });

    it('Bad request if id is invalid', async () => {
      const id = 'invalid-id';
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships?itemId=${id}`,
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      app.close();
    });

    it('Cannot delete a membership over a missing item', async () => {
      const id = getDummyItem().id;
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships?itemId=${id}`,
      });

      expect(response.json()).toEqual(new ItemNotFound(id));
      expect(response.statusCode).toBe(StatusCodes.NOT_FOUND);
      app.close();
    });
    it('Cannot delete a missing membership', async () => {
      const item = getDummyItem();
      mockItemServiceGet([item]);

      const app = await build();
      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships?itemId=${item.id}`,
      });

      expect(response.json()).toEqual(new MemberCannotAccess(item.id));
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      app.close();
    });
    it('Cannot delete if can only read membership', async () => {
      const item = getDummyItem();
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Read })];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships?itemId=${item.id}`,
      });

      expect(response.json()).toEqual(new MemberCannotAdminItem(item.id));
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      app.close();
    });
    it('Cannot delete if can only write membership', async () => {
      const item = getDummyItem();
      const memberships = [buildMembership({ path: item.path, permission: PermissionLevel.Write })];
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships?itemId=${item.id}`,
      });

      expect(response.json()).toEqual(new MemberCannotAdminItem(item.id));
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      app.close();
    });
    it(`Cannot delete more than ${MAX_ITEM_MEMBERSHIPS_FOR_DELETE} memberships`, async () => {
      const item = getDummyItem();
      const memberships = Array.from({ length: MAX_ITEM_MEMBERSHIPS_FOR_DELETE + 1 }, () =>
        buildMembership({ path: item.path, permission: PermissionLevel.Admin }),
      );
      mockItemServiceGet([item]);
      mockItemMembershipServiceGetForMemberAtItem(memberships);
      mockItemMembershipServiceGetAllInSubtree(memberships);
      const app = await build();
      const response = await app.inject({
        method: HttpMethod.DELETE,
        url: `/item-memberships?itemId=${item.id}`,
      });

      expect(response.json()).toEqual(new TooManyMemberships());
      expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      app.close();
    });
  });
});
