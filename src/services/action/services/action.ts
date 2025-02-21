import { singleton } from 'tsyringe';

import { forwarded } from '@fastify/forwarded';
import { FastifyRequest } from 'fastify';

import { ClientManager, Context } from '@graasp/sdk';

import { Actor } from '../../../drizzle/schema';
import { BaseLogger } from '../../../logger';
import { Repositories } from '../../../utils/repositories';
import { ItemService } from '../../item/service';
import { MemberService } from '../../member/service';
import { Action } from '../entities/action';
import { getGeolocationIp } from '../utils/actions';

@singleton()
export class ActionService {
  itemService: ItemService;
  memberService: MemberService;
  logger: BaseLogger;

  constructor(itemService: ItemService, memberService: MemberService, logger: BaseLogger) {
    this.itemService = itemService;
    this.memberService = memberService;
    this.logger = logger;
  }

  async postMany(
    member: Actor,
    repositories: Repositories,
    request: FastifyRequest,
    actions: (Partial<Action> & Pick<Action, 'type'>)[],
  ): Promise<void> {
    const { headers } = request;
    //TODO: should we assert that the member is a "member" ?
    // prevent saving if member is defined and has disabled saveActions
    if (member && member.enableSaveActions === false) {
      return;
    }

    // prevent saving if item disabled analytics
    actions.filter((action) => action.item?.settings?.enableSaveActions ?? true);
    if (actions.length === 0) {
      return;
    }

    let view = Context.Unknown;
    try {
      if (headers?.origin) {
        view = ClientManager.getInstance().getContextByLink(headers?.origin);
      }
    } catch (e) {
      // do nothing
      this.logger.error(e);
      // view will default to unknown
    }
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
