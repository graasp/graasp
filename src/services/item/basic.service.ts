import { singleton } from 'tsyringe';

import { PermissionLevel, PermissionLevelOptions, ResultOf } from '@graasp/sdk';

import { type DBConnection } from '../../drizzle/db';
import { ItemMembershipRaw, ItemVisibilityWithItem, ItemWithCreator } from '../../drizzle/types';
import { BaseLogger } from '../../logger';
import { MaybeUser } from '../../types';
import { AuthorizationService } from '../authorization';
import { ItemRepository } from './item.repository';

@singleton()
export class BasicItemService {
  private readonly log: BaseLogger;
  protected readonly itemRepository: ItemRepository;
  private readonly authorizationService: AuthorizationService;

  constructor(
    itemRepository: ItemRepository,
    authorizationService: AuthorizationService,
    log: BaseLogger,
  ) {
    this.itemRepository = itemRepository;
    this.authorizationService = authorizationService;
    this.log = log;
  }

  /**
   * internally get for an item
   * @param actor
   * @param id
   * @param permission
   * @returns
   */
  async _get(
    dbConnection: DBConnection,
    actor: MaybeUser,
    id: string,
    permission: PermissionLevelOptions = PermissionLevel.Read,
  ) {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, id);

    const { itemMembership, visibilities } = await this.authorizationService.validatePermission(
      dbConnection,
      permission,
      actor,
      item,
    );
    return { item, itemMembership, visibilities };
  }

  /**
   * get for an item
   * @param actor
   * @param id
   * @param permission
   * @returns
   */
  async get(
    dbConnection: DBConnection,
    actor: MaybeUser,
    id: string,
    permission: PermissionLevelOptions = PermissionLevel.Read,
  ) {
    const { item } = await this._get(dbConnection, actor, id, permission);

    return item;
  }

  /**
   * internally get generic items
   * @param actor
   * @param ids
   * @returns result of items given ids
   */
  async _getMany(
    dbConnection: DBConnection,
    actor: MaybeUser,
    ids: string[],
  ): Promise<{
    items: ResultOf<ItemWithCreator>;
    itemMemberships: ResultOf<ItemMembershipRaw | null>;
    visibilities: ResultOf<ItemVisibilityWithItem[] | null>;
  }> {
    const result = await this.itemRepository.getMany(dbConnection, ids);
    // check memberships
    // remove items if they do not have permissions
    const { itemMemberships, visibilities } =
      await this.authorizationService.validatePermissionMany(
        dbConnection,
        PermissionLevel.Read,
        actor,
        Object.values(result.data),
      );

    for (const [id, _item] of Object.entries(result.data)) {
      // Do not delete if value exist but is null, because no memberships but can be public
      if (itemMemberships?.data[id] === undefined) {
        delete result.data[id];
      }
    }

    return { items: result, itemMemberships, visibilities };
  }

  /**
   * get generic items
   * @param actor
   * @param ids
   * @returns
   */
  async getMany(dbConnection: DBConnection, actor: MaybeUser, ids: string[]) {
    const { items, itemMemberships } = await this._getMany(dbConnection, actor, ids);

    return {
      data: items.data,
      errors: items.errors.concat(itemMemberships?.errors ?? []),
    };
  }
}
