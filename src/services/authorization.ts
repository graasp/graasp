import { singleton } from 'tsyringe';

import {
  ItemVisibilityType,
  PermissionLevel,
  PermissionLevelCompare,
  PermissionLevelOptions,
  ResultOf,
} from '@graasp/sdk';

import { DBConnection } from '../drizzle/db';
import { Item, ItemMembershipRaw, ItemVisibilityWithItem } from '../drizzle/types';
import { MaybeUser } from '../types';
import {
  MemberCannotAccess,
  MemberCannotAdminItem,
  MemberCannotReadItem,
  MemberCannotWriteItem,
} from '../utils/errors';
import { ItemVisibilityRepository } from './item/plugins/itemVisibility/itemVisibility.repository';
import { ItemMembershipRepository } from './itemMembership/membership.repository';

const permissionMapping: { [K in PermissionLevelOptions]: PermissionLevelOptions[] } = {
  [PermissionLevel.Read]: [PermissionLevel.Read],
  [PermissionLevel.Write]: [PermissionLevel.Read, PermissionLevel.Write],
  [PermissionLevel.Admin]: [PermissionLevel.Read, PermissionLevel.Write, PermissionLevel.Admin],
};

@singleton()
export class AuthorizationService {
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;

  constructor(
    itemMembershipRepository: ItemMembershipRepository,
    itemVisibilityRepository: ItemVisibilityRepository,
  ) {
    this.itemMembershipRepository = itemMembershipRepository;
    this.itemVisibilityRepository = itemVisibilityRepository;
  }

  /**
   * Verify if actor has access (or has the necessary rights) to a given item
   * This function checks the member's memberships, if the item is public and if it is hidden.
   * @param permission minimum permission required
   * @param actor member that tries to access the item
   * @param item
   * @throws if the user cannot access the item
   */
  public async validatePermissionMany(
    db: DBConnection,
    permission: PermissionLevelOptions,
    actor: { id: string } | undefined,
    items: Item[],
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
    const inheritedMemberships = actor
      ? await this.itemMembershipRepository.getInheritedMany(db, items, actor.id, true)
      : null;
    const visibilities = await this.itemVisibilityRepository.getManyForMany(db, items, [
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
      if (highest === PermissionLevel.Read || (isPublic && !highest)) {
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

    return { itemMemberships: resultOfMemberships, visibilities };
  }

  public async hasPermission(
    db: DBConnection,
    permission: PermissionLevelOptions,
    actor: MaybeUser,
    item: Item,
  ) {
    try {
      await this.validatePermission(db, permission, actor, item);
      return true;
    } catch (err: unknown) {
      return false;
    }
  }

  public async validatePermission(
    db: DBConnection,
    permission: PermissionLevelOptions,
    actor: { id: string } | undefined,
    item: Item,
  ): Promise<{
    itemMembership: ItemMembershipRaw | null;
    visibilities: ItemVisibilityWithItem[];
  }> {
    // get best permission for user
    // but do not fetch membership for signed out member

    const inheritedMembership = actor
      ? await this.itemMembershipRepository.getInherited(db, item.path, actor.id, true)
      : null;
    const highest = inheritedMembership?.permission;
    const isValid = highest && permissionMapping[highest].includes(permission);
    let isPublic = false;
    const visibilities = await this.itemVisibilityRepository.getByItemPath(db, item.path);
    if (highest === PermissionLevel.Read || permission === PermissionLevel.Read) {
      isPublic = Boolean(visibilities.find((t) => t.type === ItemVisibilityType.Public));
    }

    // HIDDEN CHECK - prevent read
    // cannot read if your have read access only
    // or if the item is public so you would have normally access without permission
    if (highest === PermissionLevel.Read || (isPublic && !highest)) {
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
    if (permission === PermissionLevel.Read && isPublic) {
      return { itemMembership: inheritedMembership, visibilities };
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
  }

  // TODO: This is only used here but should probably be put in a better place than the plugin file
  async isItemVisible(db: DBConnection, actor: MaybeUser, itemPath: Item['path']) {
    const isHidden = await this.itemVisibilityRepository.getType(
      db,
      itemPath,
      ItemVisibilityType.Hidden,
    );
    // If the item is hidden AND there is no membership with the user, then throw an error
    if (isHidden) {
      if (!actor) {
        // If actor is not provided, then there is no membership
        return false;
      }

      // Check if the actor has at least write permission
      const membership = await this.itemMembershipRepository.getByAccountAndItemPath(
        db,
        actor?.id,
        itemPath,
      );
      if (!membership || PermissionLevelCompare.lt(membership.permission, PermissionLevel.Write)) {
        return false;
      }
    }

    return true;
  }
}
