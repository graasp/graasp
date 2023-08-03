import { Result } from 'ioredis';
import { resourceLimits } from 'worker_threads';

import { ItemTagType, PermissionLevel, PermissionLevelCompare, ResultOf } from '@graasp/sdk';

import {
  MemberCannotAccess,
  MemberCannotAdminItem,
  MemberCannotReadItem,
  MemberCannotWriteItem,
} from '../utils/errors';
import { Repositories } from '../utils/repositories';
import { Item } from './item/entities/Item';
import { ItemMembership } from './itemMembership/entities/ItemMembership';
import { Actor } from './member/entities/member';

const permissionMapping = {
  [PermissionLevel.Read]: [PermissionLevel.Read],
  [PermissionLevel.Write]: [PermissionLevel.Read, PermissionLevel.Write],
  [PermissionLevel.Admin]: [PermissionLevel.Read, PermissionLevel.Write, PermissionLevel.Admin],
};

/**
 * Verify if actor has access (or has the necessary rights) to a given item
 * This function checks the member's memberships, if the item is public and if it is hidden.
 * @param repositories
 * @param permission minimum permission required
 * @param member member that tries to access the item
 * @param item
 * @throws if the user cannot access the item
 */

export const validatePermissionMany = async (
  { itemMembershipRepository, itemTagRepository }: Repositories,
  permission: PermissionLevel,
  member: Actor,
  items: Item[],
): Promise<ResultOf<ItemMembership | null>> => {
  // batch request for all items
  const inheritedMemberships = member
    ? await itemMembershipRepository.getInheritedMany(items, member, true)
    : null;
  const tags = await itemTagRepository.hasManyForMany(items, [
    ItemTagType.Public,
    ItemTagType.Hidden,
  ]);

  const result: ResultOf<ItemMembership | null> = {
    data: inheritedMemberships?.data ?? {},
    errors: [],
  };

  for (const item of items) {
    const highest = result.data[item.id]?.permission;
    const isValid = highest && permissionMapping[highest].includes(permission);

    // HIDDEN CHECK - prevent read
    // cannot read if your have read access only
    if (highest === PermissionLevel.Read) {
      const isHidden = tags.data[item.id].includes(ItemTagType.Hidden);
      if (isHidden) {
        delete result.data[item.id];
        result.errors.push(new MemberCannotAccess(item.id));
      }
    }

    // correct membership level pass successfully
    if (isValid) {
      continue;
    }

    // PUBLIC CHECK
    if (permission === PermissionLevel.Read) {
      const isPublic = tags.data[item.id].includes(ItemTagType.Public);
      if (isPublic) {
        // Old validate permission return null when public, this is a bit odd but this is current behavior
        // It is used so that the item is not removed from the list when it is public in ItemService.getMany
        result.data[item.id] = null;
        continue;
      }
    }

    if (!inheritedMemberships?.data[item.id]) {
      delete inheritedMemberships?.data[item.id];
      result.errors.push(new MemberCannotAccess(item.id));
      continue;
    }

    // add corresponding error
    delete inheritedMemberships?.data[item.id];
    switch (permission) {
      case PermissionLevel.Read:
        result.errors.push(new MemberCannotReadItem(item.id));
        break;
      case PermissionLevel.Write:
        result.errors.push(new MemberCannotWriteItem(item.id));
        break;
      case PermissionLevel.Admin:
        result.errors.push(new MemberCannotAdminItem(item.id));
        break;
      default:
        result.errors.push(new Error(`${permission} is not a valid permission`));
        break;
    }
  }

  console.log(result);

  return result;
};

export const validatePermission = async (
  { itemMembershipRepository, itemTagRepository }: Repositories,
  permission: PermissionLevel,
  member: Actor,
  item: Item,
): Promise<ItemMembership | null> => {
  // get best permission for user
  // but do not fetch membership for signed out member

  const inheritedMembership = member
    ? await itemMembershipRepository.getInherited(item, member, true)
    : null;
  const highest = inheritedMembership?.permission;
  const isValid = highest && permissionMapping[highest].includes(permission);
  let tags;
  if (highest === PermissionLevel.Read || permission === PermissionLevel.Read) {
    tags = await itemTagRepository.hasMany(item, [ItemTagType.Public, ItemTagType.Hidden]);
  }

  // HIDDEN CHECK - prevent read
  // cannot read if your have read access only
  if (highest === PermissionLevel.Read) {
    const isHidden = tags.data[ItemTagType.Hidden];
    if (isHidden) {
      throw new MemberCannotAccess(item.id);
    }
  }

  // correct membership level pass successfully
  if (isValid) {
    return inheritedMembership;
  }

  // PUBLIC CHECK
  if (permission === PermissionLevel.Read) {
    const isPublic = tags.data[ItemTagType.Public];
    if (isPublic) {
      return inheritedMembership;
    }
  }
  if (!inheritedMembership) {
    throw new MemberCannotAccess(item.id);
  }

  // throw corresponding error
  switch (permission) {
    case PermissionLevel.Read:
      throw new MemberCannotReadItem(item.id);
    case PermissionLevel.Write:
      throw new MemberCannotWriteItem(item.id);
    case PermissionLevel.Admin:
      throw new MemberCannotAdminItem(item.id);
    default:
      throw new Error(`${permission} is not a valid permission`);
  }
};

/**
 * Filtering function that takes out limited items (eg. hidden children)
 *  */
export const filterOutItems = async (actor: Actor, repositories, items: Item[]) => {
  const { itemMembershipRepository } = repositories;

  if (!items.length) {
    return [];
  }

  // TODO: optimize with on query
  const { data: memberships } = actor
    ? await itemMembershipRepository.getForManyItems(items, actor.id)
    : { data: [] };
  const isHidden = await repositories.itemTagRepository.hasForMany(items, ItemTagType.Hidden);
  return items
    .filter((item) => {
      // TODO: get best permission
      const permission = PermissionLevelCompare.getHighest(
        memberships[item.id]?.map(({ permission }) => permission),
      );
      // return item if has at least write permission or is not hidden
      return (
        (permission && PermissionLevelCompare.gte(permission, PermissionLevel.Write)) ||
        !isHidden.data[item.id]
      );
    })
    .filter(Boolean);
};

/**
 * Filter out children based on tag only.
 * It does not show hidden for admin as well, which is useful for published items
 *  */
export const filterOutHiddenItems = async (repositories: Repositories, items: Item[]) => {
  const { itemTagRepository } = repositories;

  if (!items.length) {
    return [];
  }

  const isHidden = await itemTagRepository.hasForMany(items, ItemTagType.Hidden);
  return items.filter((item) => {
    return !isHidden.data[item.id];
  });
};
