import { isBefore } from 'date-fns';
import { singleton } from 'tsyringe';

import { FastifyRequest } from 'fastify';

import {
  AggregateBy,
  AggregateFunction,
  AggregateMetric,
  Context,
  CountGroupBy,
  ItemType,
  PermissionLevel,
  UUID,
} from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Account, ActionWithItem } from '../../../../drizzle/schema';
import { AuthenticatedUser } from '../../../../types';
import { UnauthorizedMember } from '../../../../utils/errors';
import { ActionRepository } from '../../../action/action.repository';
import { ActionService } from '../../../action/action.service';
import {
  DEFAULT_ACTIONS_SAMPLE_SIZE,
  MAX_ACTIONS_SAMPLE_SIZE,
  MIN_ACTIONS_SAMPLE_SIZE,
} from '../../../action/constants';
import { InvalidAggregationError } from '../../../action/utils/errors';
import { ChatMessage } from '../../../chat/chatMessage';
import { ChatMessageRepository } from '../../../chat/repository';
import { ItemMembershipRepository } from '../../../itemMembership/repository';
import { Item } from '../../entities/Item';
import { ItemService } from '../../service';
import { AppAction } from '../app/appAction/appAction';
import { AppActionRepository } from '../app/appAction/repository';
import { AppData } from '../app/appData/appData';
import { AppDataRepository } from '../app/appData/repository';
import { AppSetting } from '../app/appSetting/appSettings';
import { BaseAnalytics } from './base-analytics';
import { ItemActionType } from './utils';
import { AppSettingRepository } from '../app/appSetting/repository';

@singleton()
export class ActionItemService {
  private readonly itemService: ItemService;
  private readonly actionService: ActionService;
  private readonly actionRepository: ActionRepository;
  private readonly appActionRepository: AppActionRepository;
  private readonly appSettingRepository: AppSettingRepository;
  private readonly chatMessageRepository: ChatMessageRepository;
  private readonly itemMembershipRepository: ItemMembershipRepository;
  private readonly appDataRepository: AppDataRepository;

  constructor(
    actionService: ActionService,
    itemService: ItemService,
    actionRepository: ActionRepository,
    itemMembershipRepository: ItemMembershipRepository,
    appActionRepository: AppActionRepository,
    appSettingRepository: AppSettingRepository,
    appDataRepository: AppDataRepository,
  ) {
    this.actionService = actionService;
    this.itemService = itemService;
    this.actionRepository = actionRepository;
    this.itemMembershipRepository = itemMembershipRepository;
    this.appActionRepository = appActionRepository;
    this.appSettingRepository = appSettingRepository;
    this.appDataRepository = appDataRepository;
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
    const item = await this.itemService.get(db, actor, itemId, PermissionLevel.Read);

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

  async getAnalyticsAggregation(
    db: DBConnection,
    actor: Actor,
    payload: {
      itemId: string;
      sampleSize?: number;
      view?: string;
      type?: string[];
      countGroupBy: CountGroupBy[];
      aggregationParams?: {
        aggregateFunction: AggregateFunction;
        aggregateMetric: AggregateMetric;
        aggregateBy?: AggregateBy[];
      };
      startDate?: string;
      endDate?: string;
    },
  ) {
    // check rights
    const item = await this.itemService.get(db, actor, payload.itemId, PermissionLevel.Read);

    if (payload.startDate && payload.endDate && isBefore(payload.endDate, payload.startDate)) {
      throw new InvalidAggregationError('start date should be before end date');
    }
    // get actions aggregation
    const aggregateActions = await this.actionRepository.getAggregationForItem(
      db,
      item.path,
      {
        sampleSize: payload.sampleSize,
        view: payload.view,
        types: payload.type,
        startDate: payload.startDate,
        endDate: payload.endDate,
      },
      payload.countGroupBy,
      payload.aggregationParams,
    );

    return aggregateActions;
  }

  async getBaseAnalyticsForItem(
    db: DBConnection,
    actor: Account,
    payload: {
      itemId: string;
      sampleSize?: number;
      view?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<BaseAnalytics> {
    // prevent access from unautorized members
    if (!actor) {
      throw new UnauthorizedMember();
    }

    // check right and get item
    const item = await this.itemService.get(db, actor, payload.itemId, PermissionLevel.Read);

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
    const inheritedMemberships =
      (await this.itemMembershipRepository.getForManyItems(db, [item])).data?.[item.id] ?? [];
    // TODO: use db argument passed from the transaction
    const itemMemberships = await this.itemMembershipRepository.getAllBellowItemPath(db, item.path);
    const allMemberships = [...inheritedMemberships, ...itemMemberships];
    // get members
    const members =
      permission === PermissionLevel.Admin ? allMemberships.map(({ account }) => account) : [actor];

    // get descendants items
    const descendants = await this.itemService.getFilteredDescendants(db, actor, payload.itemId);

    // chatbox for all items
    const chatMessages = Object.values(
      (
        await this.chatMessageRepository.getByItems(db, [
          payload.itemId,
          ...descendants.map(({ id }) => id),
        ])
      ).data,
    ).flat() as ChatMessage[];

    // get for all app-item
    const apps: {
      [key: UUID]: {
        data: AppData[];
        settings: AppSetting[];
        actions: AppAction[];
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

    // set all data in last task's result
    return new BaseAnalytics({
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
    });
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
}
