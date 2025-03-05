import { singleton } from 'tsyringe';

import { forwarded } from '@fastify/forwarded';
import { FastifyRequest } from 'fastify';

import { ClientManager, Context } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { Item } from '../../drizzle/types';
import { BaseLogger } from '../../logger';
import { AuthenticatedUser } from '../../types';
import { ItemService } from '../item/service';
import { MemberRepository } from '../member/repository';
import { MemberService } from '../member/service';
import { ActionRepository } from './action.repository';
import { getGeolocationIp } from './utils/actions';

@singleton()
export class ActionService {
  actionRepository: ActionRepository;
  memberRepository: MemberRepository;
  itemService: ItemService;
  memberService: MemberService;
  logger: BaseLogger;

  constructor(
    actionRepository: ActionRepository,
    memberRepository: MemberRepository,
    itemService: ItemService,
    memberService: MemberService,
    logger: BaseLogger,
  ) {
    this.actionRepository = actionRepository;
    this.memberRepository = memberRepository;
    this.itemService = itemService;
    this.memberService = memberService;
    this.logger = logger;
  }

  async postMany(
    db: DBConnection,
    actor: AuthenticatedUser,
    request: FastifyRequest,
    actions: { item: Item; type: string; extra: unknown }[],
  ): Promise<void> {
    const { headers } = request;
    // expand member to the full account
    const member = actor ? await this.memberRepository.get(db, actor.id) : null;
    //TODO: should we assert that the member is a "member" ?
    // prevent saving if member is defined and has disabled saveActions
    if (member && member.toMemberInfo().enableSaveActions === false) {
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
      accountId: member?.id,
      geolocation: geolocation ?? undefined,
      view,
      extra: JSON.stringify({}),
      ...a,
    }));

    await this.actionRepository.postMany(db, completeActions);
  }
}
