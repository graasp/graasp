import {
  Item,
  ItemMembership,
  ItemMembershipService,
  ItemService,
  Member,
  MemberService,
  PermissionLevel,
} from '@graasp/sdk';
import { getIdsFromPath } from '@graasp/utils';
import { ActionService } from 'graasp-plugin-actions';

import { buildAction } from './fixtures/actions';
import { getDummyItem } from './fixtures/items';
import { ACTOR, buildMember } from './fixtures/members';
import { buildMembership } from './fixtures/memberships';

// Item Membership Service
export const mockItemMembershipServiceGetForMemberAtItem = (
  memberships: ItemMembership[],
): jest.SpyInstance => {
  return jest
    .spyOn(ItemMembershipService.prototype, 'getForMemberAtItem')
    .mockImplementation(async (memberId, { id: itemId }) => {
      return memberships.find(
        ({ memberId: thisMemberId, itemPath }) =>
          getIdsFromPath(itemPath).includes(itemId) && thisMemberId === memberId,
      );
    });
};

export const mockItemMembershipServiceCreate = (): jest.SpyInstance => {
  return jest
    .spyOn(ItemMembershipService.prototype, 'create')
    .mockImplementation(async (membership) =>
      buildMembership({ ...membership, creator: ACTOR.id }),
    );
};

export const mockItemMembershipServiceUpdate = (
  memberships: ItemMembership[],
): jest.SpyInstance => {
  return jest
    .spyOn(ItemMembershipService.prototype, 'update')
    .mockImplementation(async (id: string, permission: PermissionLevel) => {
      const m = memberships.find(({ id: thisId }) => thisId === id);
      return { ...m, permission };
    });
};

export const mockItemMembershipServiceGetAllInSubtree = (
  memberships: ItemMembership[],
): jest.SpyInstance => {
  return jest
    .spyOn(ItemMembershipService.prototype, 'getAllInSubtree')
    .mockImplementation(async (item: Item) => {
      return memberships.filter(({ itemPath }) => itemPath.includes(item.path));
    });
};

export const mockItemMemberhipServiceGetInheritedForAll = (
  memberships: ItemMembership[],
): jest.SpyInstance => {
  return jest
    .spyOn(ItemMembershipService.prototype, 'getInheritedForAll')
    .mockImplementation(async (item: Item) =>
      memberships.filter((membership) => membership.itemPath === item.path),
    );
};

// define response directly
export const mockItemMemberhipServiceGetInherited = (
  membership?: ItemMembership,
): jest.SpyInstance => {
  return jest
    .spyOn(ItemMembershipService.prototype, 'getInherited')
    .mockImplementation(async () => membership);
};

// define response directly
export const mockItemMemberhipServiceGet = (memberships: ItemMembership[]): jest.SpyInstance => {
  return jest
    .spyOn(ItemMembershipService.prototype, 'get')
    .mockImplementation(async (id) => memberships.find(({ id: thisId }) => id === thisId));
};

// define response directly
export const mockItemMemberhipServiceGetAllBelow = (
  memberships: ItemMembership[],
): jest.SpyInstance => {
  return jest
    .spyOn(ItemMembershipService.prototype, 'getAllBelow')
    .mockImplementation(async () => memberships);
};

// define response directly
export const mockItemMemberhipServiceDelete = (memberships: ItemMembership[]): jest.SpyInstance => {
  return jest
    .spyOn(ItemMembershipService.prototype, 'delete')
    .mockImplementation(async (id) => memberships.find(({ id: thisId }) => id === thisId));
};

// Item Service
export const mockItemServiceGet = (items: Item[]): jest.SpyInstance => {
  return jest
    .spyOn(ItemService.prototype, 'get')
    .mockImplementation(async (id) => items.find(({ id: thisId }) => id === thisId));
};

export const mockItemServiceGetMany = (items: Item[]): jest.SpyInstance => {
  return jest.spyOn(ItemService.prototype, 'getMany').mockImplementation(async (ids) => {
    return items.filter(({ id: thisId }) => ids.includes(thisId));
  });
};

export const mockItemServiceGetNumberOfChildren = (fn = async () => 0): jest.SpyInstance => {
  return jest.spyOn(ItemService.prototype, 'getNumberOfChildren').mockImplementation(fn);
};
export const mockItemServiceGetNumberOfLevelsToFarthestChild = (
  fn = async () => 0,
): jest.SpyInstance => {
  return jest
    .spyOn(ItemService.prototype, 'getNumberOfLevelsToFarthestChild')
    .mockImplementation(fn);
};

export const mockItemServiceCreate = (): jest.SpyInstance => {
  return jest
    .spyOn(ItemService.prototype, 'create')
    .mockImplementation(async (partialItem) => getDummyItem(partialItem));
};

export const mockItemServiceGetNumberOfDescendants = (fn = async () => 0): jest.SpyInstance => {
  return jest.spyOn(ItemService.prototype, 'getNumberOfDescendants').mockImplementation(fn);
};

export const mockItemServiceGetOwn = (items: Item[]): jest.SpyInstance => {
  return jest.spyOn(ItemService.prototype, 'getOwn').mockResolvedValue(items);
};

export const mockItemServiceGetSharedWith = (items: Item[]): jest.SpyInstance => {
  return jest.spyOn(ItemService.prototype, 'getSharedWith').mockResolvedValue(items);
};

export const mockItemServiceGetChildren = (fn = async () => []): jest.SpyInstance => {
  return jest.spyOn(ItemService.prototype, 'getChildren').mockImplementation(fn);
};

export const mockItemServiceGetDescendants = (
  fn: () => Promise<Item[]> = async () => [],
): jest.SpyInstance => {
  return jest.spyOn(ItemService.prototype, 'getDescendants').mockImplementation(fn);
};

export const mockItemServiceUpdate = (items: Item[]): jest.SpyInstance => {
  return jest.spyOn(ItemService.prototype, 'update').mockImplementation(async (id, data) => {
    const item = items.find(({ id: thisId }) => id === thisId);
    return { ...item, ...data };
  });
};

export const mockItemServiceDelete = (items: Item[]): jest.SpyInstance => {
  return jest.spyOn(ItemService.prototype, 'delete').mockImplementation(async (id) => {
    return items.find(({ id: thisId }) => id === thisId);
  });
};

export const mockItemServiceMove = (): jest.SpyInstance => {
  return jest.spyOn(ItemService.prototype, 'move').mockImplementation();
};

export const mockItemServiceGetMatchingPath = (items: Item[]): jest.SpyInstance => {
  return jest
    .spyOn(ItemService.prototype, 'getMatchingPath')
    .mockImplementation(async (itemPath) => {
      return items.find(({ path }) => itemPath === path);
    });
};

// Member Service
export const mockMemberServiceGet = (members: Member[]): jest.SpyInstance => {
  return jest.spyOn(MemberService.prototype, 'get').mockImplementation(async (id) => {
    return members.find(({ id: thisId }) => id === thisId);
  });
};

export const mockMemberServiceGetMatching = (members: Member[]): jest.SpyInstance => {
  return jest
    .spyOn(MemberService.prototype, 'getMatching')
    .mockImplementation(async ({ email }) => {
      return members.filter(({ email: thisEmail }) => email === thisEmail);
    });
};

export const mockMemberServiceUpdate = (members: Member[]): jest.SpyInstance => {
  return jest.spyOn(MemberService.prototype, 'update').mockImplementation(async (id, data) => {
    const member = members.find(({ id: thisId }) => id === thisId);
    return { ...member, ...data };
  });
};

export const mockMemberServiceDelete = (members: Member[]): jest.SpyInstance => {
  return jest.spyOn(MemberService.prototype, 'delete').mockImplementation(async (id) => {
    return members.find(({ id: thisId }) => id === thisId);
  });
};

export const mockMemberServiceCreate = (): jest.SpyInstance => {
  return jest.spyOn(MemberService.prototype, 'create').mockImplementation(async (data) => {
    return buildMember(data);
  });
};

export const mockActionServiceCreate = (): jest.SpyInstance => {
  return jest.spyOn(ActionService.prototype, 'create').mockImplementation(async (data) => {
    return buildAction(data);
  });
};
