import { and, count, eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import type { FastifyRequest } from 'fastify';

import { type DBConnection } from '../../../../drizzle/db';
import { actionsTable } from '../../../../drizzle/schema';
import type { ActionWithItem } from '../../../../drizzle/types';
import type { AuthenticatedUser, MaybeUser } from '../../../../types';
import { UnauthorizedMember } from '../../../../utils/errors';
import { ActionRepository } from '../../../action/action.repository';
import { ActionService } from '../../../action/action.service';
import {
  DEFAULT_ACTIONS_SAMPLE_SIZE,
  MAX_ACTIONS_SAMPLE_SIZE,
  MIN_ACTIONS_SAMPLE_SIZE,
} from '../../../action/constants';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import type { ItemRaw } from '../../item';
import { type ActionDateFilters, ItemActionRepository } from './itemAction.repository';
import { View, type ViewOptions } from './itemAction.schemas';
import { ItemActionType } from './utils';

@singleton()
export class ItemActionService {
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly actionService: ActionService;
  private readonly actionRepository: ActionRepository;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly itemActionRepository: ItemActionRepository;

  constructor(
    actionService: ActionService,
    authorizedItemService: AuthorizedItemService,
    actionRepository: ActionRepository,
    itemMembershipRepository: ItemMembershipRepository,
    itemActionRepository: ItemActionRepository,
  ) {
    this.actionService = actionService;
    this.authorizedItemService = authorizedItemService;
    this.actionRepository = actionRepository;
    this.itemMembershipRepository = itemMembershipRepository;
    this.itemActionRepository = itemActionRepository;
  }

  async getForItem(
    dbConnection: DBConnection,
    account: AuthenticatedUser,
    itemId: string,
    filters: { view?: ViewOptions; sampleSize?: number } = {},
  ): Promise<ActionWithItem[]> {
    const { view = View.Builder, sampleSize = DEFAULT_ACTIONS_SAMPLE_SIZE } = filters;

    // prevent access from unautorized members
    if (!account) {
      throw new UnauthorizedMember();
    }

    // check right and get item
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: account.id,
      itemId,
      permission: 'read',
    });

    // check permission
    const permission = (
      await this.itemMembershipRepository.getInherited(dbConnection, item.path, account.id, true)
    )?.permission;

    // Check validity of the requestSampleSize parameter (it is a number between min and max constants)
    let size = DEFAULT_ACTIONS_SAMPLE_SIZE;
    if (sampleSize) {
      // If it is an integer, return the value bounded between min and max
      if (Number.isInteger(sampleSize)) {
        size = Math.min(Math.max(sampleSize, MIN_ACTIONS_SAMPLE_SIZE), MAX_ACTIONS_SAMPLE_SIZE);
        // If it is not valid, set the default value
      } else {
        size = DEFAULT_ACTIONS_SAMPLE_SIZE;
      }
    }

    // get actions
    return this.actionRepository.getForItem(dbConnection, item.path, {
      sampleSize: size,
      view,
      accountId: permission === 'admin' ? undefined : account.id,
    });
  }

  async postPostAction(dbConnection: DBConnection, request: FastifyRequest, item: ItemRaw) {
    const { user } = request;
    const action = {
      item,
      type: ItemActionType.Create,
      extra: { itemId: item.id },
    };
    await this.actionService.postMany(dbConnection, user?.account, request, [action]);
  }

  async postPatchAction(dbConnection: DBConnection, request: FastifyRequest, item: ItemRaw) {
    const { user } = request;
    const action = {
      item,
      type: ItemActionType.Update,
      extra: { itemId: item.id, body: request.body },
    };
    await this.actionService.postMany(dbConnection, user?.account, request, [action]);
  }

  async postManyDeleteAction(
    dbConnection: DBConnection,
    request: FastifyRequest,
    items: ItemRaw[],
  ) {
    const { user } = request;
    const actions = items.map((item) => ({
      // cannot include item since is has been deleted
      type: ItemActionType.Delete,
      extra: { itemId: item.id },
    }));
    await this.actionService.postMany(dbConnection, user?.account, request, actions);
  }

  async postManyMoveAction(dbConnection: DBConnection, request: FastifyRequest, items: ItemRaw[]) {
    const { user } = request;
    const actions = items.map((item) => ({
      item,
      type: ItemActionType.Move,
      extra: { itemId: item.id, body: request.body },
    }));
    await this.actionService.postMany(dbConnection, user?.account, request, actions);
  }

  async postManyCopyAction(dbConnection: DBConnection, request: FastifyRequest, items: ItemRaw[]) {
    const { user } = request;
    const actions = items.map((item) => ({
      item,
      type: ItemActionType.Copy,
      extra: { itemId: item.id, body: request.body },
    }));
    await this.actionService.postMany(dbConnection, user?.account, request, actions);
  }

  async getTotalViewsCountForItemId(dbConnection: DBConnection, itemId: ItemRaw['id']) {
    const res = await dbConnection
      .select({ count: count() })
      .from(actionsTable)
      .where(
        and(
          eq(actionsTable.view, 'library'),
          eq(actionsTable.type, 'collection-view'),
          eq(actionsTable.itemId, itemId),
        ),
      );
    return res[0].count;
  }

  async getActionsByHour(
    dbConnection: DBConnection,
    itemId: ItemRaw['id'],
    maybeUser: MaybeUser,
    params: ActionDateFilters,
  ) {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });

    return this.itemActionRepository.getActionsByHour(dbConnection, item.path, maybeUser, params);
  }

  async getActionsByDay(
    dbConnection: DBConnection,
    itemId: ItemRaw['id'],
    maybeUser: MaybeUser,
    params: ActionDateFilters,
  ) {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });

    return this.itemActionRepository.getActionsByDay(dbConnection, item.path, maybeUser, params);
  }

  async getActionsByWeekday(
    dbConnection: DBConnection,
    itemId: ItemRaw['id'],
    maybeUser: MaybeUser,
    params: ActionDateFilters,
  ) {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });

    return this.itemActionRepository.getActionsByWeekday(
      dbConnection,
      item.path,
      maybeUser,
      params,
    );
  }
}
