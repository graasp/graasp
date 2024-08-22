import { singleton } from 'tsyringe';

import { forwarded } from '@fastify/forwarded';
import { FastifyRequest } from 'fastify';

import { Repositories } from '../../../utils/repositories';
import { ItemService } from '../../item/service';
import { Actor, isMember } from '../../member/entities/member';
import { MemberService } from '../../member/service';
import { Action } from '../entities/action';
import { getGeolocationIp, getView } from '../utils/actions';

@singleton()
export class ActionService {
  itemService: ItemService;
  memberService: MemberService;

  constructor(itemService: ItemService, memberService: MemberService) {
    this.itemService = itemService;
    this.memberService = memberService;
  }

  async postMany(
    member: Actor,
    repositories: Repositories,
    request: FastifyRequest,
    actions: (Partial<Action> & Pick<Action, 'type'>)[],
  ): Promise<void> {
    const { headers } = request;

    // prevent saving if member is defined and has disabled saveActions
    if (member && isMember(member) && member.enableSaveActions === false) {
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
      account: member,
      geolocation: geolocation ?? undefined,
      view,
      extra: {},
      ...a,
    }));

    await repositories.actionRepository.postMany(completeActions);
  }
}
