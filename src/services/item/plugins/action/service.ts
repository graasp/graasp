import { FastifyReply, FastifyRequest } from 'fastify';

import { Context, Hostname, PermissionLevel } from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../utils/errors';
import { Repositories, buildRepositories } from '../../../../utils/repositories';
import { Action } from '../../../action/entities/action';
import { ActionService } from '../../../action/services/action';
import { validatePermission } from '../../../authorization';
import { Actor } from '../../../member/entities/member';
import { MemberService } from '../../../member/service';
import { Item } from '../../entities/Item';
import ItemService from '../../service';
import { BaseAnalytics } from './base-analytics';
import {
  DEFAULT_ACTIONS_SAMPLE_SIZE,
  ItemActionType,
  MAX_ACTIONS_SAMPLE_SIZE,
  MIN_ACTIONS_SAMPLE_SIZE,
} from './utils';

export class ActionItemService {
  itemService: ItemService;
  memberService: MemberService;
  actionService: ActionService;
  hosts: Hostname[];

  constructor(
    actionService: ActionService,
    itemService: ItemService,
    memberService: MemberService,
    hosts: Hostname[],
  ) {
    this.actionService = actionService;
    this.hosts = hosts;
    this.itemService = itemService;
    this.memberService = memberService;
  }

  // async postMany(
  //   member: Actor,
  //   repositories: Repositories,
  //   actions: Partial<Action>[]
  // ): Promise<Action[]> {

  //     return repositories.actionRepository.postMany(actions);

  // }

  async getForItem(
    actor: Actor,
    repositories: Repositories,
    itemId: string,
    filters: { view?: Context; sampleSize?: number },
  ): Promise<Action[]> {
    const { view = Context.BUILDER, sampleSize = DEFAULT_ACTIONS_SAMPLE_SIZE } = filters;
    // get item
    const item = await this.itemService.get(actor, repositories, itemId);

    // check member has admin membership over item
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

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
    });
  }

  async getBaseAnalyticsForItem(
    actor: Actor,
    repositories: Repositories,
    payload: { itemId: string; sampleSize?: number; view?: string },
  ): Promise<BaseAnalytics> {
    if (!actor) {
      throw new UnauthorizedMember();
    }

    // get item and check rights
    const item = await this.itemService.get(actor, repositories, payload.itemId);
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    // check membership and get actions
    const actions = await repositories.actionRepository.getForItem(item.path);

    // get memberships
    const inheritedMemberships =
      (await repositories.itemMembershipRepository.getForManyItems([item])).data?.[item.id] ?? [];
    const itemMemberships = await repositories.itemMembershipRepository.getAllBelow(item);
    const allMemberships = [...inheritedMemberships, ...itemMemberships];
    // get members
    const members = allMemberships.map(({ member }) => member);

    // get descendants items
    const descendants = await this.itemService.getDescendants(actor, repositories, payload.itemId);

    // set all data in last task's result
    return new BaseAnalytics({
      item,
      descendants,
      actions,
      members,
      itemMemberships: allMemberships,
      metadata: {
        numActionsRetrieved: actions.length,
        requestedSampleSize: payload.sampleSize ?? MAX_ACTIONS_SAMPLE_SIZE,
      },
    });
  }

  async postPostAction(request: FastifyRequest, reply: FastifyReply, item: Item) {
    const { member } = request;
    const action = {
      item,
      type: ItemActionType.Create,
      extra: { itemId: item.id },
    };
    await this.actionService.postMany(member, buildRepositories(), request, [action]);
  }

  async postPatchAction(request: FastifyRequest, reply: FastifyReply, item: Item) {
    const { member } = request;
    const action = {
      item,
      type: ItemActionType.Update,
      // TODO: remove any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extra: { itemId: item.id, body: request.body as any },
    };
    await this.actionService.postMany(member, buildRepositories(), request, [action]);
  }

  async postManyPatchAction(request: FastifyRequest, reply: FastifyReply, items: Item[]) {
    const { member } = request;
    const actions = items.map((item) => ({
      item,
      type: ItemActionType.Update,
      // TODO: remove any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extra: { itemId: item.id, body: request.body as any },
    }));
    await this.actionService.postMany(member, buildRepositories(), request, actions);
  }

  async postManyDeleteAction(request: FastifyRequest, reply: FastifyReply, items: Item[]) {
    const { member } = request;
    const actions = items.map((item) => ({
      item,
      type: ItemActionType.Delete,
      extra: { itemId: item.id },
    }));
    await this.actionService.postMany(member, buildRepositories(), request, actions);
  }

  async postManyMoveAction(request: FastifyRequest, reply: FastifyReply, items: Item[]) {
    const { member } = request;
    const actions = items.map((item) => ({
      item,
      type: ItemActionType.Move,
      // TODO: remove any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extra: { itemId: item.id, body: request.body as any },
    }));
    await this.actionService.postMany(member, buildRepositories(), request, actions);
  }

  async postManyCopyAction(request: FastifyRequest, reply: FastifyReply, items: Item[]) {
    const { member } = request;
    const actions = items.map((item) => ({
      item,
      type: ItemActionType.Copy,
      // TODO: remove any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      extra: { itemId: item.id, body: request.body as any },
    }));
    await this.actionService.postMany(member, buildRepositories(), request, actions);
  }
}
