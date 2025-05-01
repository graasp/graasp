import { singleton } from 'tsyringe';

import { PermissionLevel, PermissionLevelOptions, ResultOf } from '@graasp/sdk';

import { type DBConnection } from '../../drizzle/db';
import { ItemMembershipRaw, ItemVisibilityWithItem, ItemWithCreator } from '../../drizzle/types';
import { BaseLogger } from '../../logger';
import { MaybeUser } from '../../types';
import { AuthorizedItemService } from '../authorization';
import { ItemRepository } from './item.repository';

@singleton()
export class BasicItemService {
  private readonly log: BaseLogger;
  protected readonly itemRepository: ItemRepository;
  private readonly authorizedItemService: AuthorizedItemService;

  constructor(
    itemRepository: ItemRepository,
    authorizedItemService: AuthorizedItemService,
    log: BaseLogger,
  ) {
    this.itemRepository = itemRepository;
    this.authorizedItemService = authorizedItemService;
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

    const { itemMembership, visibilities } = await this.authorizedItemService.validatePermission(
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
  async getMany(
    dbConnection: DBConnection,
    actor: MaybeUser,
    ids: string[],
  ): Promise<{
    items: ItemWithCreator[];
    itemMemberships: ResultOf<ItemMembershipRaw | null>;
    visibilities: ResultOf<ItemVisibilityWithItem[] | null>;
  }> {
    const result = await this.itemRepository.getMany(dbConnection, ids);

    // check memberships
    // remove items if they do not have permissions
    const { itemMemberships, visibilities } =
      await this.authorizedItemService.validatePermissionMany(
        dbConnection,
        PermissionLevel.Read,
        actor,
        result,
      );

    // Do not exclude if value exist but is null, because no memberships but can be public
    const items = result.filter((i) => itemMemberships?.data[i.id] !== undefined);

    return { items, itemMemberships, visibilities };
  }
}
