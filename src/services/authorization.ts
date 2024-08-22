import { FastifyRequest, RouteGenericInterface, RouteHandlerMethod } from 'fastify';

import { ItemTagType, PermissionLevel, PermissionLevelCompare, ResultOf } from '@graasp/sdk';

import {
  InsufficientPermission,
  MemberCannotAccess,
  MemberCannotAdminItem,
  MemberCannotReadItem,
  MemberCannotWriteItem,
} from '../utils/errors';
import { Repositories } from '../utils/repositories';
import { ItemWrapper, PackedItem } from './item/ItemWrapper';
import { Item } from './item/entities/Item';
import { ItemTag } from './item/plugins/itemTag/ItemTag';
import { ItemTagRepository } from './item/plugins/itemTag/repository';
import { ItemMembership } from './itemMembership/entities/ItemMembership';
import { ItemMembershipRepository } from './itemMembership/repository';
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
 * @param actor member that tries to access the item
 * @param item
 * @throws if the user cannot access the item
 */
export const validatePermissionMany = async (
  {
    itemMembershipRepository,
    itemTagRepository,
  }: {
    itemMembershipRepository: typeof ItemMembershipRepository;
    itemTagRepository: ItemTagRepository;
  },
  permission: PermissionLevel,
  actor: Actor,
  items: Item[],
): Promise<{
  itemMemberships: ResultOf<ItemMembership | null>;
  tags: ResultOf<ItemTag[] | null>;
}> => {
  // items array is empty, nothing to check return early
  if (!items.length) {
    return {
      itemMemberships: { data: {}, errors: [] },
      tags: { data: {}, errors: [] },
    };
  }

  // batch request for all items
  const inheritedMemberships = actor
    ? await itemMembershipRepository.getInheritedMany(items, actor, true)
    : null;
  const tags = await itemTagRepository.getManyForMany(items, [
    ItemTagType.Public,
    ItemTagType.Hidden,
  ]);

  const resultOfMemberships: ResultOf<ItemMembership | null> = {
    data: inheritedMemberships?.data ?? {},
    errors: [],
  };

  for (const item of items) {
    const highest = resultOfMemberships.data[item.id]?.permission;
    const isValid = highest && permissionMapping[highest].includes(permission);
    const isPublic = tags.data[item.id].find((t) => t.type === ItemTagType.Public);

    // HIDDEN CHECK - prevent read
    // cannot read if your have read access only
    if (highest === PermissionLevel.Read || (isPublic && !highest)) {
      const isHidden = tags.data[item.id].find((t) => t.type === ItemTagType.Hidden);
      if (isHidden) {
        delete resultOfMemberships.data[item.id];
        resultOfMemberships.errors.push(new MemberCannotAccess(item.id));
        continue;
      }
    }

    // correct membership level pass successfully
    if (isValid) {
      continue;
    }

    // PUBLIC CHECK
    if (permission === PermissionLevel.Read && isPublic) {
      // Old validate permission return null when public, this is a bit odd but this is current behavior
      // It is used so that the item is not removed from the list when it is public in ItemService.getMany
      resultOfMemberships.data[item.id] = null;
      continue;
    }

    if (!inheritedMemberships?.data[item.id]) {
      delete inheritedMemberships?.data[item.id];
      resultOfMemberships.errors.push(new MemberCannotAccess(item.id));
      continue;
    }

    // add corresponding error
    delete inheritedMemberships?.data[item.id];
    switch (permission) {
      case PermissionLevel.Read:
        resultOfMemberships.errors.push(new MemberCannotReadItem(item.id));
        break;
      case PermissionLevel.Write:
        resultOfMemberships.errors.push(new MemberCannotWriteItem(item.id));
        break;
      case PermissionLevel.Admin:
        resultOfMemberships.errors.push(new MemberCannotAdminItem(item.id));
        break;
      default:
        resultOfMemberships.errors.push(new Error(`${permission} is not a valid permission`));
        break;
    }
  }

  return { itemMemberships: resultOfMemberships, tags };
};

export const validatePermission = async (
  {
    itemMembershipRepository,
    itemTagRepository,
  }: {
    itemMembershipRepository: typeof ItemMembershipRepository;
    itemTagRepository: ItemTagRepository;
  },
  permission: PermissionLevel,
  actor: Actor,
  item: Item,
): Promise<{ itemMembership: ItemMembership | null; tags: ItemTag[] }> => {
  // get best permission for user
  // but do not fetch membership for signed out member

  const inheritedMembership = actor
    ? await itemMembershipRepository.getInherited(item, actor, true)
    : null;
  const highest = inheritedMembership?.permission;
  const isValid = highest && permissionMapping[highest].includes(permission);
  let isPublic = false;
  const tags = await itemTagRepository.getForItem(item);
  if (highest === PermissionLevel.Read || permission === PermissionLevel.Read) {
    isPublic = Boolean(tags.find((t) => t.type === ItemTagType.Public));
  }

  // HIDDEN CHECK - prevent read
  // cannot read if your have read access only
  // or if the item is public so you would have normally access without permission
  if (highest === PermissionLevel.Read || (isPublic && !highest)) {
    const isHidden = Boolean(tags.find((t) => t.type === ItemTagType.Hidden));
    if (isHidden) {
      throw new MemberCannotAccess(item.id);
    }
  }

  // correct membership level pass successfully
  if (isValid) {
    return { itemMembership: inheritedMembership, tags };
  }

  // PUBLIC CHECK
  if (permission === PermissionLevel.Read && isPublic) {
    return { itemMembership: inheritedMembership, tags };
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
 * Internal filtering function that takes out limited items (eg. hidden children)
 *  */
const _filterOutItems = async (
  actor: Actor,
  repositories: Repositories,
  items: Item[],
  options?: { showHidden?: boolean },
) => {
  const { itemMembershipRepository } = repositories;
  const showHidden = options?.showHidden ?? true;
  if (!items.length) {
    return { items: [], memberships: [] };
  }

  // TODO: optimize with on query
  const { data: memberships } = actor
    ? await itemMembershipRepository.getForManyItems(items, {
        accountId: actor.id,
      })
    : { data: [] };

  const tags = await repositories.itemTagRepository.getManyForMany(items, [
    ItemTagType.Hidden,
    ItemTagType.Public,
  ]);
  const filteredItems = items.filter((item) => {
    const isHidden = tags.data[item.id].find((t) => t.type === ItemTagType.Hidden);
    if (isHidden && !showHidden) {
      return false;
    }
    const permission = PermissionLevelCompare.getHighest(
      memberships[item.id]?.map(({ permission }) => permission),
    );

    // return item if has at least write permission or is not hidden
    return (
      (permission && PermissionLevelCompare.gte(permission, PermissionLevel.Write)) || !isHidden
    );
  });
  return { items: filteredItems, memberships, tags };
};

/**
 * Filtering function that takes out limited items (eg. hidden children)
 *  */
export const filterOutItems = async (
  actor: Actor,
  repositories,
  items: Item[],
): Promise<Item[]> => {
  return (await _filterOutItems(actor, repositories, items)).items;
};

/**
 * Filtering function that takes out limited items (eg. hidden children) and return packed items
 *  */
export const filterOutPackedItems = async (
  actor: Actor,
  repositories,
  items: Item[],
  options?: { showHidden?: boolean },
): Promise<PackedItem[]> => {
  const {
    items: filteredItems,
    memberships,
    tags,
  } = await _filterOutItems(actor, repositories, items, options);
  return filteredItems.map((item) => {
    const permission = PermissionLevelCompare.getHighest(
      memberships[item.id]?.map(({ permission }) => permission),
    );
    // return packed item
    return new ItemWrapper(
      item,
      permission ? { permission } : undefined,
      tags?.data[item.id],
    ).packed();
  });
};

/**
 * Filtering function that takes out limited descendants (eg. hidden children) and return packed items
 * @param item item is parent of descendants, suppose actor has at least access to it
 * @param descendants flat list of descendants of item
 *  */
export const filterOutPackedDescendants = async (
  actor: Actor,
  repositories,
  item: Item,
  descendants: Item[],
  options?: { showHidden?: boolean },
): Promise<PackedItem[]> => {
  const { itemMembershipRepository, itemTagRepository } = repositories;
  const showHidden = options?.showHidden ?? true;

  if (!descendants.length) {
    return [];
  }

  const allMemberships = actor
    ? await itemMembershipRepository.getAllBelow(item, actor.id, {
        considerLocal: true,
        selectItem: true,
      })
    : [];
  const tags = await itemTagRepository.getManyBelowAndSelf(item, [
    ItemTagType.Hidden,
    ItemTagType.Public,
  ]);

  return (
    descendants
      // packed item
      .map((item) => {
        const permissions = allMemberships
          .filter((m) => item.path.includes(m.item.path))
          .map(({ permission }) => permission);
        const permission = PermissionLevelCompare.getHighest(permissions);
        const itemTags = tags.filter((t) => item.path.includes(t.item.path));

        return new ItemWrapper(item, permission ? { permission } : undefined, itemTags).packed();
      })
      .filter((i) => {
        if (i.hidden && !showHidden) {
          return false;
        }

        // return item if has at least write permission or is not hidden
        return (
          (i.permission && PermissionLevelCompare.gte(i.permission, PermissionLevel.Write)) ||
          !i.hidden
        );
      })
  );
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

/**
 * Pre-handler function that checks if the user meets at least one of the specified access preconditions.
 * @param strategies The array of role strategies to check for access.
 * @throws {InsufficientPermission} If user does not satisfy any of the preconditions.
 * @throws {GraaspAuthError} If only one role strategy is provided and it failed with a provided error.
 */
export function matchOne<R extends RouteGenericInterface>(
  ...strategies: RessourceAuthorizationStrategy<R>[]
): RouteHandlerMethod {
  return async (req: FastifyRequest<R>) => {
    if (!strategies.some((strategy) => strategy.test(req))) {
      // If none of the strategies pass, throw an error.

      // If only one strategy is provided, throw that error. Otherwise, throw a generic error.
      if (strategies.length === 1 && strategies[0].error) {
        throw new strategies[0].error();
      } else {
        throw new InsufficientPermission();
      }
    }
  };
}

export type RessourceAuthorizationStrategy<
  R extends RouteGenericInterface = RouteGenericInterface,
> = {
  test: (req: FastifyRequest<R>) => boolean;
  error?: new () => Error;
};
