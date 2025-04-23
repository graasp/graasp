import { isBefore } from 'date-fns';
import { and, count, eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { FastifyRequest } from 'fastify';

import { ItemType, PermissionLevel, UUID } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { actionsTable } from '../../../../drizzle/schema';
import {
  ActionWithItem,
  AppActionRaw,
  AppDataRaw,
  AppSettingRaw,
  ItemRaw,
} from '../../../../drizzle/types';
import { AuthenticatedUser, MaybeUser } from '../../../../types';
import { UnauthorizedMember } from '../../../../utils/errors';
import { ActionRepository } from '../../../action/action.repository';
import { ActionService } from '../../../action/action.service';
import {
  DEFAULT_ACTIONS_SAMPLE_SIZE,
  MAX_ACTIONS_SAMPLE_SIZE,
  MIN_ACTIONS_SAMPLE_SIZE,
} from '../../../action/constants';
import { InvalidAggregationError } from '../../../action/utils/errors';
import { filterOutItems } from '../../../authorization.utils';
import { ChatMessageRepository } from '../../../chat/chatMessage.repository';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { ExportDataRepository } from '../../../member/plugins/export-data/memberExportData.repository';
import { BasicItemService } from '../../basic.service';
import { isItemType } from '../../discrimination';
import { ItemService } from '../../item.service';
import { AppActionRepository } from '../app/appAction/appAction.repository';
import { AppDataRepository } from '../app/appData/appData.repository';
import { AppSettingRepository } from '../app/appSetting/appSetting.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemActionRepository } from './itemAction.repository';
import { View, ViewOptions } from './itemAction.schemas';
// import { BaseAnalytics } from './base-analytics';
import { ItemActionType } from './utils';

@singleton()
export class ItemActionService {
  private readonly basicItemService: BasicItemService;
  private readonly actionService: ActionService;
  private readonly actionRepository: ActionRepository;
  private readonly appActionRepository: AppActionRepository;
  private readonly appSettingRepository: AppSettingRepository;
  private readonly chatMessageRepository: ChatMessageRepository;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly appDataRepository: AppDataRepository;
  private readonly exportDataRepository: ExportDataRepository;
  private readonly itemService: ItemService;
  private readonly itemVisibilityRepository: ItemVisibilityRepository;
  private readonly itemActionRepository: ItemActionRepository;

  constructor(
    actionService: ActionService,
    basicItemService: BasicItemService,
    actionRepository: ActionRepository,
    itemMembershipRepository: ItemMembershipRepository,
    appActionRepository: AppActionRepository,
    appSettingRepository: AppSettingRepository,
    appDataRepository: AppDataRepository,
    chatMessageRepository: ChatMessageRepository,
    exportDataRepository: ExportDataRepository,
    itemService: ItemService,
    itemVisibilityRepository: ItemVisibilityRepository,
    itemActionRepository: ItemActionRepository,
  ) {
    this.actionService = actionService;
    this.basicItemService = basicItemService;
    this.actionRepository = actionRepository;
    this.itemMembershipRepository = itemMembershipRepository;
    this.appActionRepository = appActionRepository;
    this.appSettingRepository = appSettingRepository;
    this.appDataRepository = appDataRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.exportDataRepository = exportDataRepository;
    this.itemService = itemService;
    this.itemVisibilityRepository = itemVisibilityRepository;
    this.itemActionRepository = itemActionRepository;
  }

  async getForItem(
    dbConnection: DBConnection,
    actor: AuthenticatedUser,
    itemId: string,
    filters: { view?: ViewOptions; sampleSize?: number } = {},
  ): Promise<ActionWithItem[]> {
    const { view = View.Builder, sampleSize = DEFAULT_ACTIONS_SAMPLE_SIZE } = filters;

    // prevent access from unautorized members
    if (!actor) {
      throw new UnauthorizedMember();
    }

    // check right and get item
    const item = await this.basicItemService.get(dbConnection, actor, itemId, PermissionLevel.Read);

    // check permission
    const permission = (
      await this.itemMembershipRepository.getInherited(dbConnection, item.path, actor.id, true)
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
      accountId: permission === PermissionLevel.Admin ? undefined : actor.id,
    });
  }

  async getFilteredDescendants(dbConnection: DBConnection, account: MaybeUser, itemId: UUID) {
    const { descendants } = await this.itemService.getDescendants(dbConnection, account, itemId);
    if (!descendants.length) {
      return [];
    }
    // TODO optimize?
    return filterOutItems(
      dbConnection,
      account,
      {
        itemMembershipRepository: this.itemMembershipRepository,
        itemVisibilityRepository: this.itemVisibilityRepository,
      },
      descendants,
    );
  }

  async getBaseAnalyticsForItem(
    dbConnection: DBConnection,
    actor: AuthenticatedUser,
    payload: {
      itemId: string;
      sampleSize?: number;
      view?: ViewOptions;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    // prevent access from unautorized members
    if (!actor) {
      throw new UnauthorizedMember();
    }

    // check right and get item
    const item = await this.basicItemService.get(
      dbConnection,
      actor,
      payload.itemId,
      PermissionLevel.Read,
    );

    // check permission
    const permission = actor
      ? (await this.itemMembershipRepository.getInherited(dbConnection, item.path, actor.id, true))
          ?.permission
      : null;

    if (payload.startDate && payload.endDate && isBefore(payload.endDate, payload.startDate)) {
      throw new InvalidAggregationError('start date should be before end date');
    }
    // check membership and get actions
    const actions = await this.actionRepository.getForItem(dbConnection, item.path, {
      sampleSize: payload.sampleSize,
      view: payload.view,
      accountId: permission === PermissionLevel.Admin ? undefined : actor.id,
      startDate: payload.startDate,
      endDate: payload.endDate,
    });
    // get memberships
    const inheritedMemberships = await this.itemMembershipRepository.getForItem(dbConnection, item);

    const itemMemberships = await this.itemMembershipRepository.getAllBellowItemPath(
      dbConnection,
      item.path,
    );
    const allMemberships = [...inheritedMemberships, ...itemMemberships];
    // get members
    const members =
      permission === PermissionLevel.Admin ? allMemberships.map(({ account }) => account) : [actor];

    // get descendants items
    let descendants: ItemRaw[] = [];
    if (isItemType(item, ItemType.FOLDER)) {
      descendants = await this.getFilteredDescendants(dbConnection, actor, payload.itemId);
    }
    // chatbox for all items
    const chatMessages = await this.chatMessageRepository.getByItems(dbConnection, [
      payload.itemId,
      ...descendants.map(({ id }) => id),
    ]);

    // get for all app-item
    const apps: {
      [key: UUID]: {
        data: AppDataRaw[];
        settings: AppSettingRaw[];
        actions: AppActionRaw[];
      };
    } = {};
    const appItems = [item, ...descendants].filter(({ type }) => type === ItemType.APP);
    for (const { id: appId } of appItems) {
      const appData = await this.appDataRepository.getForItem(
        dbConnection,
        appId,
        {},
        // needs investigating: does this mean a reader could export the actions of an item and see all users responses ?
        PermissionLevel.Admin,
      );
      // TODO member id?
      // todo: create getForItems?
      const appActions = await this.appActionRepository.getForItem(dbConnection, appId, {});
      const appSettings = await this.appSettingRepository.getForItem(dbConnection, appId);

      apps[appId] = {
        data: appData,
        actions: appActions,
        settings: appSettings,
      };
    }

    return {
      item,
      descendants,
      actions,
      members,
      itemMemberships: allMemberships,
      chatMessages,
      apps,
      metadata: {
        numActionsRetrieved: actions.length,
        requestedSampleSize: payload.sampleSize ?? MAX_ACTIONS_SAMPLE_SIZE,
      },
    };
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
    actor: MaybeUser,
    params,
  ) {
    const item = await this.basicItemService.get(dbConnection, actor, itemId);

    return this.itemActionRepository.getActionsByHour(dbConnection, item.path, actor, params);
  }

  async getActionsByDay(
    dbConnection: DBConnection,
    itemId: ItemRaw['id'],
    actor: MaybeUser,
    params,
  ) {
    const item = await this.basicItemService.get(dbConnection, actor, itemId);

    return this.itemActionRepository.getActionsByDay(dbConnection, item.path, actor, params);
  }

  async getActionsByWeekday(
    dbConnection: DBConnection,
    itemId: ItemRaw['id'],
    actor: MaybeUser,
    params,
  ) {
    const item = await this.basicItemService.get(dbConnection, actor, itemId);

    return this.itemActionRepository.getActionsByWeekday(dbConnection, item.path, actor, params);
  }
}
