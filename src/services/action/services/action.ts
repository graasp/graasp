import forwarded from '@fastify/forwarded';
import { FastifyRequest } from 'fastify';

import { Repositories } from '../../../utils/repositories';
import ItemService from '../../item/service';
import { Actor } from '../../member/entities/member';
import { MemberService } from '../../member/service';
import { Action } from '../entities/action';
import { getGeolocationIp, getView } from '../utils/actions';

export class ActionService {
  itemService: ItemService;
  memberService: MemberService;
  // itemMembershipsService: ItemMembershipService;

  constructor(
    itemService: ItemService,
    // itemMembershipsService: ItemMembershipService,
    memberService: MemberService,
  ) {
    this.itemService = itemService;
    // this.itemMembershipsService = itemMembershipsService;
    this.memberService = memberService;
  }

  // TODO: remove if it not used
  async postMany(
    member: Actor,
    repositories: Repositories,
    request: FastifyRequest,
    actions: (Partial<Action> & Pick<Action, 'type'>)[],
  ): Promise<void> {
    const { headers } = request;

    // prevent saving if member disabled
    const enableMemberSaving = member?.extra?.enableSaveActions ?? true;
    if (!enableMemberSaving) {
      return;
    }

    // prevent saving if item disabled analytics
    actions.filter((action) => action.item?.settings?.enableSaveActions ?? true);
    if (actions.length === 0) {
      return;
    }

    const view = getView(headers);
    // warning: addresses might contained spoofed ips
    const addresses = forwarded(request.raw);
    const ip = addresses.pop();

    const geolocation = ip ? getGeolocationIp(ip) : null;
    const completeActions = actions.map((a) => ({
      member,
      geolocation: geolocation ?? undefined,
      view,
      extra: {},
      ...a,
    }));

    await repositories.actionRepository.postMany(completeActions);
  }

  async post(
    member: Actor,
    repositories: Repositories,
    request: FastifyRequest,
    action: Partial<Action> & Pick<Action, 'type'>,
  ): Promise<void> {
    const { headers } = request;

    // prevent saving if member disabled
    const enableMemberSaving = member?.extra?.enableSaveActions ?? true;
    if (!enableMemberSaving) {
      return;
    }

    // prevent saving if item disabled analytics
    if (action.item?.settings?.enableSaveActions) {
      return;
    }

    const view = getView(headers);
    // warning: addresses might contained spoofed ips
    const addresses = forwarded(request.raw);
    const ip = addresses.pop();

    const geolocation = ip ? getGeolocationIp(ip) : null;
    const completeAction = {
      member,
      geolocation: geolocation ?? undefined,
      view,
      extra: {},
      ...action,
    };

    await repositories.actionRepository.post(completeAction);
  }
}
