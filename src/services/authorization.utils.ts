import { ItemVisibilityType, PermissionLevelCompare } from '@graasp/sdk';

import type { DBConnection } from '../drizzle/db';
import type { ItemRaw, ItemWithCreator } from '../drizzle/types';
import type { MaybeUser } from '../types';
import { ItemWrapper, type PackedItem } from './item/ItemWrapper';
import { ItemVisibilityRepository } from './item/plugins/itemVisibility/itemVisibility.repository';
import type { ItemsThumbnails } from './item/plugins/thumbnail/types';
import { ItemMembershipRepository } from './itemMembership/membership.repository';

/**
 * Internal filtering function that takes out limited items (eg. hidden children)
 *  */
const _filterOutItems = async (
  dbConnection: DBConnection,
  actor: MaybeUser,
  {
    itemMembershipRepository,
    itemVisibilityRepository,
  }: {
    itemMembershipRepository: ItemMembershipRepository;
    itemVisibilityRepository: ItemVisibilityRepository;
  },
  items: ItemRaw[],
  options?: { showHidden?: boolean },
) => {
  const showHidden = options?.showHidden ?? true;
  if (!items.length) {
    return { items: [], memberships: [] };
  }

  // TODO: optimize with one query
  const { data: memberships } = actor
    ? await itemMembershipRepository.getForManyItems(dbConnection, items, {
        accountId: actor.id,
      })
    : { data: [] };

  const visibilities = await itemVisibilityRepository.getManyForMany(dbConnection, items, [
    ItemVisibilityType.Hidden,
    ItemVisibilityType.Public,
  ]);
  const filteredItems = items.filter((item) => {
    const isHidden = visibilities.data[item.id].find((t) => t.type === ItemVisibilityType.Hidden);
    if (isHidden && !showHidden) {
      return false;
    }
    const permission = PermissionLevelCompare.getHighest(
      memberships[item.id]?.map(({ permission }) => permission),
    );

    // return item if has at least write permission or is not hidden
    return (permission && PermissionLevelCompare.gte(permission, 'write')) || !isHidden;
  });
  return { items: filteredItems, memberships, visibilities };
};

/**
 * Filtering function that takes out limited items (eg. hidden children)
 *  */
export const filterOutItems = async (
  dbConnection: DBConnection,
  actor: MaybeUser,
  {
    itemMembershipRepository,
    itemVisibilityRepository,
  }: {
    itemMembershipRepository: ItemMembershipRepository;
    itemVisibilityRepository: ItemVisibilityRepository;
  },
  items: ItemRaw[],
): Promise<ItemRaw[]> => {
  return (
    await _filterOutItems(
      dbConnection,
      actor,
      { itemMembershipRepository, itemVisibilityRepository },
      items,
    )
  ).items;
};

/**
 * Filtering function that takes out limited items (eg. hidden children) and return packed items
 *  */
export const filterOutPackedItems = async <T extends ItemRaw = ItemRaw>(
  dbConnection: DBConnection,
  actor: MaybeUser,
  {
    itemMembershipRepository,
    itemVisibilityRepository,
  }: {
    itemMembershipRepository: ItemMembershipRepository;
    itemVisibilityRepository: ItemVisibilityRepository;
  },
  items: T[],
  itemsThumbnails?: ItemsThumbnails,
  options?: { showHidden?: boolean },
): Promise<PackedItem[]> => {
  const {
    items: filteredItems,
    memberships,
    visibilities,
  } = await _filterOutItems(
    dbConnection,
    actor,
    { itemMembershipRepository, itemVisibilityRepository },
    items,
    options,
  );
  return filteredItems.map((item) => {
    const permission = PermissionLevelCompare.getHighest(
      memberships[item.id]?.map(({ permission }) => permission),
    );
    const thumbnails = itemsThumbnails?.[item.id];
    // return packed item
    return new ItemWrapper(
      item,
      permission ? { permission } : undefined,
      visibilities?.data[item.id],
      thumbnails,
    ).packed();
  });
};

/**
 * Filtering function that takes out limited descendants (eg. hidden children) and return packed items
 * @param item item is parent of descendants, suppose actor has at least access to it
 * @param descendants flat list of descendants of item
 *  */
export const filterOutPackedDescendants = async (
  dbConnection: DBConnection,
  actor: MaybeUser,
  { itemMembershipRepository, itemVisibilityRepository },
  item: ItemRaw,
  descendants: ItemWithCreator[],
  itemsThumbnails?: ItemsThumbnails,
  options?: { showHidden?: boolean },
): Promise<PackedItem[]> => {
  const showHidden = options?.showHidden ?? true;

  if (!descendants.length) {
    return [];
  }

  const allMemberships = actor
    ? await itemMembershipRepository.getAllBelow(dbConnection, item.path, actor.id, {
        considerLocal: true,
        selectItem: true,
      })
    : [];
  const visibilities = await itemVisibilityRepository.getManyBelowAndSelf(dbConnection, item, [
    ItemVisibilityType.Hidden,
    ItemVisibilityType.Public,
  ]);

  return (
    descendants
      // packed item
      .map((item) => {
        const permissions = allMemberships
          .filter((m) => item.path.includes(m.item.path))
          .map(({ permission }) => permission);
        const permission = PermissionLevelCompare.getHighest(permissions);
        const itemVisibilities = visibilities.filter((t) => item.path.includes(t.item.path));

        const packedItem = new ItemWrapper(
          item,
          permission ? { permission } : undefined,
          itemVisibilities,
          itemsThumbnails?.[item.id],
        ).packed();
        return packedItem;
      })
      .filter((i) => {
        if (i.hidden && !showHidden) {
          return false;
        }

        // return item if has at least write permission or is not hidden
        return (i.permission && PermissionLevelCompare.gte(i.permission, 'write')) || !i.hidden;
      })
  );
};

/**
 * Filter out children based on hidden visibilities only.
 * It does not show hidden for admin as well, which is useful for published items
 *  */
export const filterOutHiddenItems = async (
  dbConnection: DBConnection,
  { itemVisibilityRepository },
  items: ItemRaw[],
) => {
  if (!items.length) {
    return [];
  }

  const isHidden = await itemVisibilityRepository.hasForMany(
    dbConnection,
    items,
    ItemVisibilityType.Hidden,
  );
  return items.filter((item) => {
    return !isHidden.data[item.id];
  });
};
