import { isBefore } from 'date-fns';
import { and, count, eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { FastifyRequest } from 'fastify';

import { Context, ItemType, PermissionLevel, UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { actionsTable } from '../../../../drizzle/schema';
import {
  ActionWithItem,
  AppActionRaw,
  AppDataRaw,
  AppSettingRaw,
  Item,
  ItemRaw,
  MinimalAccount,
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
import { ItemVisibilityRepository } from '../itemVisibility/repository';
// import { BaseAnalytics } from './base-analytics';
import { ItemActionType } from './utils';

@singleton()
export class ActionItemService {
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
  }

  async getForItem(
    db: DBConnection,
    actor: AuthenticatedUser,
    itemId: string,
    filters: { view?: Context; sampleSize?: number } = {},
  ): Promise<ActionWithItem[]> {
    const { view = Context.Builder, sampleSize = DEFAULT_ACTIONS_SAMPLE_SIZE } = filters;

    // prevent access from unautorized members
    if (!actor) {
      throw new UnauthorizedMember();
    }

    // check right and get item
    const item = await this.basicItemService.get(db, actor, itemId, PermissionLevel.Read);

    // check permission
    const permission = (
      await this.itemMembershipRepository.getInherited(db, item.path, actor.id, true)
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
    return this.actionRepository.getForItem(db, item.path, {
      sampleSize: size,
      view,
      accountId: permission === PermissionLevel.Admin ? undefined : actor.id,
    });
  }

  // async getAnalyticsAggregation(
  //   db: DBConnection,
  //   actor: MaybeUser,
  //   payload: {
  //     itemId: string;
  //     sampleSize?: number;
  //     view?: string;
  //     type?: string[];
  //     countGroupBy: CountGroupBy[];
  //     aggregationParams?: {
  //       aggregateFunction: AggregateFunction;
  //       aggregateMetric: AggregateMetric;
  //       aggregateBy?: AggregateBy[];
  //     };
  //     startDate?: string;
  //     endDate?: string;
  //   },
  // ) {
  //   // check rights
  //   const item = await this.itemService.get(db, actor, payload.itemId, PermissionLevel.Read);

  //   if (payload.startDate && payload.endDate && isBefore(payload.endDate, payload.startDate)) {
  //     throw new InvalidAggregationError('start date should be before end date');
  //   }
  //   // get actions aggregation
  //   const aggregateActions = await this.actionRepository.getAggregationForItem(
  //     db,
  //     item.path,
  //     {
  //       sampleSize: payload.sampleSize,
  //       view: payload.view,
  //       types: payload.type,
  //       startDate: payload.startDate,
  //       endDate: payload.endDate,
  //     },
  //     payload.countGroupBy,
  //     payload.aggregationParams,
  //   );

  //   return aggregateActions;
  // }

  async getFilteredDescendants(db: DBConnection, account: MaybeUser, itemId: UUID) {
    const { descendants } = await this.itemService.getDescendants(db, account, itemId);
    if (!descendants.length) {
      return [];
    }
    // TODO optimize?
    return filterOutItems(
      db,
      account,
      {
        itemMembershipRepository: this.itemMembershipRepository,
        itemVisibilityRepository: this.itemVisibilityRepository,
      },
      descendants,
    );
  }

  async getBaseAnalyticsForItem(
    db: DBConnection,
    actor: AuthenticatedUser,
    payload: {
      itemId: string;
      sampleSize?: number;
      view?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    // prevent access from unautorized members
    if (!actor) {
      throw new UnauthorizedMember();
    }

    // check right and get item
    const item = await this.basicItemService.get(db, actor, payload.itemId, PermissionLevel.Read);

    // check permission
    const permission = actor
      ? (await this.itemMembershipRepository.getInherited(db, item.path, actor.id, true))
          ?.permission
      : null;

    if (payload.startDate && payload.endDate && isBefore(payload.endDate, payload.startDate)) {
      throw new InvalidAggregationError('start date should be before end date');
    }
    // check membership and get actions
    const actions = await this.actionRepository.getForItem(db, item.path, {
      sampleSize: payload.sampleSize,
      view: payload.view,
      accountId: permission === PermissionLevel.Admin ? undefined : actor.id,
      startDate: payload.startDate,
      endDate: payload.endDate,
    });

    // get memberships
    const inheritedMemberships = await this.itemMembershipRepository.getForItem(db, item);
    // TODO: use db argument passed from the transaction
    const itemMemberships = await this.itemMembershipRepository.getAllBellowItemPath(db, item.path);
    const allMemberships = [...inheritedMemberships, ...itemMemberships];
    // get members
    const members =
      permission === PermissionLevel.Admin ? allMemberships.map(({ account }) => account) : [actor];

    // get descendants items
    let descendants: ItemRaw[] = [];
    if (isItemType(item, ItemType.FOLDER)) {
      descendants = await this.getFilteredDescendants(db, actor, payload.itemId);
    }
    // chatbox for all items
    const chatMessages = await this.chatMessageRepository.getByItems(db, [
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
        db,
        appId,
        {},
        // needs investigating: does this mean a reader could export the actions of an item and see all users responses ?
        PermissionLevel.Admin,
      );
      // TODO member id?
      // todo: create getForItems?
      const appActions = await this.appActionRepository.getForItem(db, appId, {});
      const appSettings = await this.appSettingRepository.getForItem(db, appId);

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

    // set all data in last task's result
    // return new BaseAnalytics({
    //   item,
    //   descendants,
    //   actions,
    //   members,
    //   itemMemberships: allMemberships,
    //   chatMessages,
    //   apps,
    //   metadata: {
    //     numActionsRetrieved: actions.length,
    //     requestedSampleSize: payload.sampleSize ?? MAX_ACTIONS_SAMPLE_SIZE,
    //   },
    // });
  }

  async postPostAction(db: DBConnection, request: FastifyRequest, item: Item) {
    const { user } = request;
    const action = {
      item,
      type: ItemActionType.Create,
      extra: { itemId: item.id },
    };
    await this.actionService.postMany(db, user?.account, request, [action]);
  }

  async postPatchAction(db: DBConnection, request: FastifyRequest, item: Item) {
    const { user } = request;
    const action = {
      item,
      type: ItemActionType.Update,
      // TODO: remove any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extra: { itemId: item.id, body: request.body as any },
    };
    await this.actionService.postMany(db, user?.account, request, [action]);
  }

  async postManyDeleteAction(db: DBConnection, request: FastifyRequest, items: Item[]) {
    const { user } = request;
    const actions = items.map((item) => ({
      // cannot include item since is has been deleted
      type: ItemActionType.Delete,
      extra: { itemId: item.id },
    }));
    await this.actionService.postMany(db, user?.account, request, actions);
  }

  async postManyMoveAction(db: DBConnection, request: FastifyRequest, items: Item[]) {
    const { user } = request;
    const actions = items.map((item) => ({
      item,
      type: ItemActionType.Move,
      // TODO: remove any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extra: { itemId: item.id, body: request.body as any },
    }));
    await this.actionService.postMany(db, user?.account, request, actions);
  }

  async postManyCopyAction(db: DBConnection, request: FastifyRequest, items: Item[]) {
    const { user } = request;
    const actions = items.map((item) => ({
      item,
      type: ItemActionType.Copy,
      // TODO: remove any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extra: { itemId: item.id, body: request.body as any },
    }));
    await this.actionService.postMany(db, user?.account, request, actions);
  }

  async getTotalViewsCountForItemId(db: DBConnection, itemId: Item['id']) {
    const res = await db
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
}
