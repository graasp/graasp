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

  async postMany(
    member: Actor,
    repositories: Repositories,
    request: FastifyRequest,
    actions: (Partial<Action> & Pick<Action, 'extra' | 'type'>)[],
  ): Promise<void> {
    const { headers } = request;

    // todo: prevent saving here if member disabled or if item disabled analytics

    const view = getView(headers);
    // warning: addresses might contained spoofed ips
    const addresses = forwarded(request.raw);
    const ip = addresses.pop();

    const geolocation = ip ? getGeolocationIp(ip) : null;

    const completeActions = actions.map((a) => ({
      member,
      geolocation: geolocation ?? undefined,
      view,
      ...a,
    }));

    await repositories.actionRepository.postMany(completeActions);
  }
}
