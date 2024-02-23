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

import { UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import {
  DEFAULT_ACTIONS_SAMPLE_SIZE,
  MAX_ACTIONS_SAMPLE_SIZE,
  MIN_ACTIONS_SAMPLE_SIZE,
} from '../../../action/constants/constants';
import { Action } from '../../../action/entities/action';
import { ActionService } from '../../../action/services/action';
import { Actor } from '../../../member/entities/member';
import { MemberService } from '../../../member/service';
import { Item } from '../../entities/Item';
import ItemService from '../../service';
import { AppAction } from '../app/appAction/appAction';
import { AppData } from '../app/appData/appData';
import { AppSetting } from '../app/appSetting/appSettings';
import { BaseAnalytics } from './base-analytics';
import { ItemActionType } from './utils';

export class ActionItemService {
  itemService: ItemService;
  memberService: MemberService;
  actionService: ActionService;

  constructor(
    actionService: ActionService,
    itemService: ItemService,
    memberService: MemberService,
  ) {
    this.actionService = actionService;
    this.itemService = itemService;
    this.memberService = memberService;
  }

  async getForItem(
    actor: Actor,
    repositories: Repositories,
    itemId: string,
    filters: { view?: Context; sampleSize?: number } = {},
  ): Promise<Action[]> {
    const { view = Context.Builder, sampleSize = DEFAULT_ACTIONS_SAMPLE_SIZE } = filters;

    // prevent access from unautorized members
    if (!actor) {
      throw new UnauthorizedMember();
    }

    // check right and get item
    const item = await this.itemService.get(actor, repositories, itemId, PermissionLevel.Read);

    // check permission
    const permission = (await repositories.itemMembershipRepository.getInherited(item, actor, true))
      ?.permission;

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
    return repositories.actionRepository.getForItem(item.path, {
      sampleSize: size,
      view,
      memberId: permission === PermissionLevel.Admin ? undefined : actor.id,
    });
  }

  async getAnalyticsAggregation(
    actor: Actor,
    repositories: Repositories,
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
    },
  ): Promise<unknown[]> {
    // check rights
    const item = await this.itemService.get(
      actor,
      repositories,
      payload.itemId,
      PermissionLevel.Read,
    );

    // get actions aggregation
    const aggregateActions = await repositories.actionRepository.getAggregationForItem(
      item.path,
      {
        sampleSize: payload.sampleSize,
        view: payload.view,
        types: payload.type,
      },
      payload.countGroupBy,
      payload.aggregationParams,
    );

    return aggregateActions;
  }

  async getBaseAnalyticsForItem(
    actor: Actor,
    repositories: Repositories,
    payload: { itemId: string; sampleSize?: number; view?: string },
  ): Promise<BaseAnalytics> {
    // prevent access from unautorized members
    if (!actor) {
      throw new UnauthorizedMember();
    }

    // check right and get item
    const item = await this.itemService.get(
      actor,
      repositories,
      payload.itemId,
      PermissionLevel.Read,
    );

    // check permission
    const permission = actor
      ? (await repositories.itemMembershipRepository.getInherited(item, actor, true))?.permission
      : null;

    // check membership and get actions
    const actions = await repositories.actionRepository.getForItem(item.path, {
      sampleSize: payload.sampleSize,
      view: payload.view,
      memberId: permission === PermissionLevel.Admin ? undefined : actor.id,
    });

    // get memberships
    const inheritedMemberships =
      (await repositories.itemMembershipRepository.getForManyItems([item])).data?.[item.id] ?? [];
    const itemMemberships = await repositories.itemMembershipRepository.getAllBelow(item);
    const allMemberships = [...inheritedMemberships, ...itemMemberships];
    // get members
    const members =
      permission === PermissionLevel.Admin ? allMemberships.map(({ member }) => member) : [actor];

    // get descendants items
    const descendants = await this.itemService.getDescendants(actor, repositories, payload.itemId);

    // chatbox for all items
    const chatMessages = Object.values(
      (
        await repositories.chatMessageRepository.getForItems([
          payload.itemId,
          ...descendants.map(({ id }) => id),
        ])
      ).data,
    ).flat();

    // get for all app-item
    const apps: {
      [key: UUID]: {
        data: AppData[];
        settings: AppSetting[];
        actions: AppAction[];
      };
    } = {};
    for (const { id: appId } of [item, ...descendants].filter(
      ({ type }) => type === ItemType.APP,
    )) {
      const appData = await repositories.appDataRepository.getForItem(
        appId,
        {},
        PermissionLevel.Admin,
      );
      // TODO member id?
      // todo: create getForItems?
      const appActions = await repositories.appActionRepository.getForItem(appId, {});
      const appSettings = await repositories.appSettingRepository.getForItem(appId);

      apps[appId] = { data: appData, actions: appActions, settings: appSettings };
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

  async postPostAction(request: FastifyRequest, repositories: Repositories, item: Item) {
    const { member } = request;
    const action = {
      item,
      type: ItemActionType.Create,
      extra: { itemId: item.id },
    };
    await this.actionService.postMany(member, repositories, request, [action]);
  }

  async postPatchAction(request: FastifyRequest, repositories: Repositories, item: Item) {
    const { member } = request;
    const action = {
      item,
      type: ItemActionType.Update,
      // TODO: remove any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extra: { itemId: item.id, body: request.body as any },
    };
    await this.actionService.postMany(member, repositories, request, [action]);
  }

  async postManyPatchAction(request: FastifyRequest, repositories: Repositories, items: Item[]) {
    const { member } = request;
    const actions = items.map((item) => ({
      item,
      type: ItemActionType.Update,
      // TODO: remove any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extra: { itemId: item.id, body: request.body as any },
    }));
    await this.actionService.postMany(member, repositories, request, actions);
  }

  async postManyDeleteAction(request: FastifyRequest, repositories: Repositories, items: Item[]) {
    const { member } = request;
    const actions = items.map((item) => ({
      // cannot include item since is has been deleted
      type: ItemActionType.Delete,
      extra: { itemId: item.id },
    }));
    await this.actionService.postMany(member, repositories, request, actions);
  }

  async postManyMoveAction(request: FastifyRequest, repositories: Repositories, items: Item[]) {
    const { member } = request;
    const actions = items.map((item) => ({
      item,
      type: ItemActionType.Move,
      // TODO: remove any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extra: { itemId: item.id, body: request.body as any },
    }));
    await this.actionService.postMany(member, repositories, request, actions);
  }

  async postManyCopyAction(request: FastifyRequest, repositories: Repositories, items: Item[]) {
    const { member } = request;
    const actions = items.map((item) => ({
      item,
      type: ItemActionType.Copy,
      // TODO: remove any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extra: { itemId: item.id, body: request.body as any },
    }));
    await this.actionService.postMany(member, repositories, request, actions);
  }
}
