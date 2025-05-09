import { singleton } from 'tsyringe';

import { ItemVisibilityType, PermissionLevel, PermissionLevelOptions, ResultOf } from '@graasp/sdk';

import { DBConnection } from '../drizzle/db';
import { ItemMembershipRaw, ItemRaw, ItemVisibilityWithItem } from '../drizzle/types';
import { MaybeUser } from '../types';
import {
  MemberCannotAccess,
  MemberCannotAdminItem,
  MemberCannotReadItem,
  MemberCannotWriteItem,
} from '../utils/errors';
import { ItemRepository } from './item/item.repository';
import { ItemVisibilityRepository } from './item/plugins/itemVisibility/itemVisibility.repository';
import { ItemMembershipRepository } from './itemMembership/membership.repository';

const permissionMapping: { [K in PermissionLevelOptions]: PermissionLevelOptions[] } = {
  [PermissionLevel.Read]: [PermissionLevel.Read],
  [PermissionLevel.Write]: [PermissionLevel.Read, PermissionLevel.Write],
  [PermissionLevel.Admin]: [PermissionLevel.Read, PermissionLevel.Write, PermissionLevel.Admin],
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
   * @param actor member that tries to access the item
   * @param items items to get properties for
   * @returns result of the highest item membership for each item, result of visibilities for each item
   */
  public async getPropertiesForItems(
    dbConnection: DBConnection,
    {
      permission = PermissionLevel.Read,
      actor,
      items,
    }: { permission: PermissionLevelOptions; actor: { id: string } | undefined; items: ItemRaw[] },
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
      ? await this.itemMembershipRepository.getInheritedMany(dbConnection, items, actor.id, true)
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

  /**
   * Returns whether the actor has a membership on the item and can access it.
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
      permission = PermissionLevel.Read,
      actor,
      item,
    }: { permission?: PermissionLevelOptions; actor: MaybeUser; item: ItemRaw },
  ) {
    try {
      const { itemMembership, visibilities } = await this.getItemWithProperties(dbConnection, {
        permission,
        actor,
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
   * Returns whether the actor can access an item.
   * @returns if the actor has an admin membership
   * @returns if the actor has a write membership
   * @returns if the actor has a read membership and the item is public
   * @returns if the actor has no membership and the item is public
   * @throws if the actor has a read membership and the item is hidden
   * @throws if the actor has no membership for a private item
   */
  public async assertAccess(
    dbConnection: DBConnection,
    {
      permission = PermissionLevel.Read,
      actor,
      item,
    }: { permission?: PermissionLevelOptions; actor: MaybeUser; item: ItemRaw },
  ) {
    await this.getItem(dbConnection, { permission, actor, item });
  }

  /**
   * Returns whether the actor can access an item.
   * refer to assertAccess
   */
  public async assertAccessForItemId(
    dbConnection: DBConnection,
    {
      permission = PermissionLevel.Read,
      actor,
      itemId,
    }: { permission?: PermissionLevelOptions; actor: MaybeUser; itemId: ItemRaw['id'] },
  ) {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);
    return await this.assertAccess(dbConnection, { permission, actor, item });
  }

  /**
   * Returns item if the actor has access to it
   * @returns item
   */
  public async getItemById(
    dbConnection: DBConnection,
    {
      permission,
      actor,
      itemId,
    }: { permission?: PermissionLevelOptions; actor: MaybeUser; itemId: ItemRaw['id'] },
  ) {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);
    return this.getItem(dbConnection, { permission, actor, item });
  }

  /**
   * Returns item if the actor has access to it
   * @returns item
   */
  public async getItem(
    dbConnection: DBConnection,
    args: { permission?: PermissionLevelOptions; actor: { id: string } | undefined; item: ItemRaw },
  ): Promise<ItemRaw> {
    return (await this.getItemWithProperties(dbConnection, args)).item;
  }

  /**
   * Returns item if the actor has access to it
   * @returns item
   */
  public async getItemWithPropertiesById(
    dbConnection: DBConnection,
    {
      permission = PermissionLevel.Read,
      actor,
      itemId,
    }: {
      permission?: PermissionLevelOptions;
      actor: { id: string } | undefined;
      itemId: ItemRaw['id'];
    },
  ): Promise<{
    item: ItemRaw;
    itemMembership: ItemMembershipRaw | null;
    visibilities: ItemVisibilityWithItem[];
  }> {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);
    return this.getItemWithProperties(dbConnection, { permission, actor, item });
  }

  /**
   * Returns item and related properties if the actor has access to it
   * @returns object of item, highest permission and visibilities
   */
  public async getItemWithProperties(
    dbConnection: DBConnection,
    {
      permission = PermissionLevel.Read,
      actor,
      item,
    }: { permission?: PermissionLevelOptions; actor: { id: string } | undefined; item: ItemRaw },
  ): Promise<{
    item: ItemRaw;
    itemMembership: ItemMembershipRaw | null;
    visibilities: ItemVisibilityWithItem[];
  }> {
    // get best permission for user
    // but do not fetch membership for signed out member

    const inheritedMembership = actor
      ? await this.itemMembershipRepository.getInherited(dbConnection, item.path, actor.id, true)
      : null;
    const highest = inheritedMembership?.permission;
    const isValid = highest && permissionMapping[highest].includes(permission);
    let isPublic = false;
    const visibilities = await this.itemVisibilityRepository.getByItemPath(dbConnection, item.path);
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
      return { item, itemMembership: inheritedMembership, visibilities };
    }

    // PUBLIC CHECK
    if (permission === PermissionLevel.Read && isPublic) {
      return { item, itemMembership: inheritedMembership, visibilities };
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
}
