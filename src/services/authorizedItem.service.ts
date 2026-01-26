import { singleton } from 'tsyringe';

import { ItemVisibilityType, type ResultOf } from '@graasp/sdk';

import type { DBConnection } from '../drizzle/db';
import type { ItemMembershipRaw, ItemRaw, ItemVisibilityWithItem } from '../drizzle/types';
import type { PermissionLevel } from '../types';
import {
  MemberCannotAccess,
  MemberCannotAdminItem,
  MemberCannotReadItem,
  MemberCannotWriteItem,
} from '../utils/errors';
import { ItemRepository } from './item/item.repository';
import { ItemVisibilityRepository } from './item/plugins/itemVisibility/itemVisibility.repository';
import { ItemMembershipRepository } from './itemMembership/membership.repository';

const permissionMapping: { [K in PermissionLevel]: PermissionLevel[] } = {
  ['read']: ['read'],
  ['write']: ['read', 'write'],
  ['admin']: ['read', 'write', 'admin'],
};

@singleton()
export class AuthorizedItemService {
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;
  private readonly itemRepository: ItemRepository;

  constructor(
    itemMembershipRepository: ItemMembershipRepository,
    itemVisibilityRepository: ItemVisibilityRepository,
    itemRepository: ItemRepository,
  ) {
    this.itemMembershipRepository = itemMembershipRepository;
    this.itemVisibilityRepository = itemVisibilityRepository;
    this.itemRepository = itemRepository;
  }

  // TODO: use this function to filter out directly, as it seems the usual use case of this function
  /**
   * Returns hightest membership and visibilities for each item if the user has access to it
   * @param permission minimum permission required
   * @param accountId member that tries to access the item
   * @param items items to get properties for
   * @returns result of the highest item membership for each item, result of visibilities for each item
   */
  public async getPropertiesForItems(
    dbConnection: DBConnection,
    {
      permission = 'read',
      accountId,
      items,
    }: { permission: PermissionLevel; accountId?: string; items: ItemRaw[] },
  ): Promise<{
    itemMemberships: ResultOf<ItemMembershipRaw | null>;
    visibilities: ResultOf<ItemVisibilityWithItem[] | null>;
  }> {
    // items array is empty, nothing to check return early
    if (!items.length) {
      return {
        itemMemberships: { data: {}, errors: [] },
        visibilities: { data: {}, errors: [] },
      };
    }

    // batch request for all items
    const inheritedMemberships = accountId
      ? await this.itemMembershipRepository.getInheritedMany(dbConnection, items, accountId, true)
      : null;
    const visibilities = await this.itemVisibilityRepository.getManyForMany(dbConnection, items, [
      ItemVisibilityType.Public,
      ItemVisibilityType.Hidden,
    ]);

    const resultOfMemberships: ResultOf<ItemMembershipRaw | null> = {
      data: inheritedMemberships?.data ?? {},
      errors: [],
    };

    for (const item of items) {
      const highest = resultOfMemberships.data[item.id]?.permission;
      const isValid = highest && permissionMapping[highest].includes(permission);
      const isPublic = visibilities.data[item.id].find((t) => t.type === ItemVisibilityType.Public);

      // HIDDEN CHECK - prevent read
      // cannot read if your have read access only
      if (highest === 'read' || (isPublic && !highest)) {
        const isHidden = visibilities.data[item.id].find(
          (t) => t.type === ItemVisibilityType.Hidden,
        );
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
      if (permission === 'read' && isPublic) {
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
        case 'read':
          resultOfMemberships.errors.push(new MemberCannotReadItem(item.id));
          break;
        case 'write':
          resultOfMemberships.errors.push(new MemberCannotWriteItem(item.id));
          break;
        case 'admin':
          resultOfMemberships.errors.push(new MemberCannotAdminItem(item.id));
          break;
        default:
          resultOfMemberships.errors.push(new Error(`${permission} is not a valid permission`));
          break;
      }
    }

    return { itemMemberships: resultOfMemberships, visibilities };
  }

  /**
   * Returns whether the account has a membership on the item and can access it.
   * Having an admin membership returns true.
   * Having a write membership returns true.
   * Having a read membership and the item is hidden returns false.
   * Having a read membership and the item is public returns true.
   * Having no membership and public returns false.
   * @returns whether the member has permission and can access the item
   */
  public async hasPermission(
    dbConnection: DBConnection,
    {
      permission = 'read',
      accountId,
      item,
    }: { permission?: PermissionLevel; accountId?: string; item: ItemRaw },
  ) {
    try {
      const { itemMembership, visibilities } = await this.getPropertiesForItem(dbConnection, {
        permission,
        accountId,
        item,
      });

      // returns false if does not have membership and item is public
      if (!itemMembership && visibilities.find(({ type }) => type === ItemVisibilityType.Public)) {
        return false;
      }

      return true;
    } catch (_e) {
      return false;
    }
  }

  /**
   * Assert the account can access an item, throws otherwise
   * @returns if the account has an admin membership
   * @returns if the account has a write membership
   * @returns if the account has a read membership and the item is public
   * @returns if the account has no membership and the item is public
   * @throws if the account has a read membership and the item is hidden
   * @throws if the account has no membership for a private item
   */
  public async assertAccess(
    dbConnection: DBConnection,
    {
      permission = 'read',
      accountId,
      item,
    }: { permission?: PermissionLevel; accountId?: string; item: ItemRaw },
  ) {
    await this.getPropertiesForItem(dbConnection, { permission, accountId, item });
  }

  /**
   * Returns whether the account can access an item.
   * refer to assertAccess
   */
  public async assertAccessForItemId(
    dbConnection: DBConnection,
    {
      permission = 'read',
      accountId,
      itemId,
    }: {
      permission?: PermissionLevel;
      accountId?: string;
      itemId: ItemRaw['id'];
    },
  ) {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);
    await this.assertAccess(dbConnection, { permission, accountId, item });
  }

  /**
   * Returns item if the account has access to it
   * @returns item
   */
  public async getItemById(
    dbConnection: DBConnection,
    {
      permission,
      accountId,
      itemId,
    }: {
      permission?: PermissionLevel;
      accountId?: string;
      itemId: ItemRaw['id'];
    },
  ) {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);
    await this.assertAccess(dbConnection, { permission, accountId, item });
    return item;
  }

  /**
   * Returns item if the account has access to it
   * @returns highest permission and visibilities
   */
  public async getPropertiesForItemById(
    dbConnection: DBConnection,
    {
      permission = 'read',
      accountId,
      itemId,
    }: {
      permission?: PermissionLevel;
      accountId?: string;
      itemId: ItemRaw['id'];
    },
  ): Promise<{
    itemMembership: ItemMembershipRaw | null;
    visibilities: ItemVisibilityWithItem[];
  }> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);
    return this.getPropertiesForItem(dbConnection, { permission, accountId, item });
  }

  /**
   * Returns item and related properties if the account has access to it
   * @returns highest permission and visibilities
   */
  public async getPropertiesForItem(
    dbConnection: DBConnection,
    {
      permission = 'read',
      accountId,
      item,
    }: { permission?: PermissionLevel; accountId?: string; item: ItemRaw },
  ): Promise<{
    itemMembership: ItemMembershipRaw | null;
    visibilities: ItemVisibilityWithItem[];
  }> {
    // get best permission for user
    // but do not fetch membership for signed out member

    const inheritedMembership = accountId
      ? await this.itemMembershipRepository.getInherited(dbConnection, item.path, accountId, true)
      : null;
    const highest = inheritedMembership?.permission;
    const isValid = highest && permissionMapping[highest].includes(permission);
    let isPublic = false;
    const visibilities = await this.itemVisibilityRepository.getByItemPath(dbConnection, item.path);
    if (highest === 'read' || permission === 'read') {
      isPublic = Boolean(visibilities.find((t) => t.type === ItemVisibilityType.Public));
    }

    // HIDDEN CHECK - prevent read
    // cannot read if your have read access only
    // or if the item is public so you would have normally access without permission
    if (highest === 'read' || (isPublic && !highest)) {
      const isHidden = Boolean(visibilities.find((t) => t.type === ItemVisibilityType.Hidden));
      if (isHidden) {
        throw new MemberCannotAccess(item.id);
      }
    }

    // correct membership level pass successfully
    if (isValid) {
      return { itemMembership: inheritedMembership, visibilities };
    }

    // PUBLIC CHECK
    if (permission === 'read' && isPublic) {
      return { itemMembership: inheritedMembership, visibilities };
    }

    if (!inheritedMembership) {
      throw new MemberCannotAccess(item.id);
    }

    // throw corresponding error
    switch (permission) {
      case 'read':
        throw new MemberCannotReadItem(item.id);
      case 'write':
        throw new MemberCannotWriteItem(item.id);
      case 'admin':
        throw new MemberCannotAdminItem(item.id);
      default:
        throw new Error(`${permission} is not a valid permission`);
    }
  }
}
