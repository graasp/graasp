import { singleton } from 'tsyringe';

import { forwarded } from '@fastify/forwarded';
import { FastifyRequest } from 'fastify';

import { ClientManager, Context } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { Item } from '../../drizzle/types';
import { BaseLogger } from '../../logger';
import { AccountType, MaybeUser } from '../../types';
import { MemberRepository } from '../member/member.repository';
import { ActionRepository } from './action.repository';
import { getGeolocationIp } from './utils/actions';

@singleton()
export class ActionService {
  actionRepository: ActionRepository;
  memberRepository: MemberRepository;
  logger: BaseLogger;

  constructor(
    actionRepository: ActionRepository,
    memberRepository: MemberRepository,
    logger: BaseLogger,
  ) {
    this.actionRepository = actionRepository;
    this.memberRepository = memberRepository;
    this.logger = logger;
  }

  async postMany(
    db: DBConnection,
    actor: MaybeUser,
    request: FastifyRequest,
    actions: { item?: Item; type: string; extra: unknown }[],
  ): Promise<void> {
    const { headers } = request;
    // expand member to the full account
    // only do it if it is an 'individual'
    const member =
      actor && actor.type === AccountType.Individual
        ? await this.memberRepository.get(db, actor.id)
        : null;
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
      accountId: actor?.id,
      geolocation: geolocation ?? undefined,
      view,
      itemId: a.item?.id,
      ...a,
      extra: a.extra ?? {},
    }));

    await this.actionRepository.postMany(db, completeActions);
  }
}
