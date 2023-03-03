import { defineAbility } from '@casl/ability';

import { ItemTagType, PermissionLevel, PermissionLevelCompare } from '@graasp/sdk';

import {
  MemberCannotAccess,
  MemberCannotAdminItem,
  MemberCannotReadItem,
  MemberCannotWriteItem,
} from '../util/graasp-error';
import { Repositories } from '../util/repositories';
import { Item } from './item/entities/Item';
import { ItemMembership } from './itemMembership/entities/ItemMembership';
import { Member } from './member/entities/member';

const ownItemAbility = (member) =>
  defineAbility((can, cannot) => {
    can(PermissionLevel.Read, 'Item', { member: member.id });
    can(PermissionLevel.Write, 'Item', { member: member.id });
    can(PermissionLevel.Admin, 'Item', { member: member.id });
  });

const permissionMapping = {
  [PermissionLevel.Read]: [PermissionLevel.Read],
  [PermissionLevel.Write]: [PermissionLevel.Read, PermissionLevel.Write],
  [PermissionLevel.Admin]: [PermissionLevel.Read, PermissionLevel.Write, PermissionLevel.Admin],
};

export const validatePermission = async (
  { itemMembershipRepository, itemTagRepository }: Repositories,
  permission: PermissionLevel,
  member: Member,
  item: Item,
): Promise<ItemMembership> => {
  // get best permission for user
  // but do not fetch membership for signed out member
  const inheritedMembership = member
    ? await itemMembershipRepository.getInherited(item, member, true)
    : null;
  const highest = inheritedMembership?.permission;
  const isValid =
    highest &&
    (ownItemAbility(member).can(permission, item) ||
      permissionMapping[highest].includes(permission));

  let tags;
  if (highest === PermissionLevel.Read || permission === PermissionLevel.Read) {
    tags = await itemTagRepository.hasMany(item, [ItemTagType.PUBLIC, ItemTagType.HIDDEN]);
  }

  // HIDDEN CHECK - prevent read
  // cannot read if your have read access only
  if (highest === PermissionLevel.Read) {
    const isHidden = tags.data[ItemTagType.HIDDEN];
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
    const isPublic = tags.data[ItemTagType.PUBLIC];
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

// filtering functions, that takes out limited items (eg. hidden children)
export const filterOutItems = async (repositories, items: Item[], parentItem?: Item) => {
  // TODO: optimize with on query
  const memberships = await repositories.itemMembershipRepository.getAllBelow(parentItem);
  const isHidden = await repositories.itemTagRepository.hasForMany(items, ItemTagType.HIDDEN);
  return items
    .filter((item) => {
      // cannot read hidden items if you don't have write access
      // TODO: get best permission
      const permission = memberships.filter(({ path }) => path === item.path);
      if (PermissionLevelCompare.lt(permission, PermissionLevel.Write)) {
        return !isHidden ? item : null;
      }
    })
    .filter(Boolean);
};
