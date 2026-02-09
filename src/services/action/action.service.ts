import { singleton } from 'tsyringe';

import { forwarded } from '@fastify/forwarded';
import type { FastifyRequest } from 'fastify';

import { ClientManager } from '@graasp/sdk';

import { type DBConnection } from '../../drizzle/db';
import { BaseLogger } from '../../logger';
import { AccountType, type MaybeUser } from '../../types';
import type { ItemRaw } from '../item/item';
import { View, ViewOptions } from '../item/plugins/action/itemAction.schemas';
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
    dbConnection: DBConnection,
    actor: MaybeUser,
    request: FastifyRequest,
    actions: { item?: ItemRaw; type: string; extra: unknown }[],
  ): Promise<void> {
    const { headers } = request;
    // expand member to the full account
    // only do it if it is an 'individual'
    const member =
      actor && actor.type === AccountType.Individual
        ? await this.memberRepository.get(dbConnection, actor.id)
        : null;
    // prevent saving if member is defined and has disabled saveActions
    if (member && member.toMemberInfo().enableSaveActions === false) {
      return;
    }

    // prevent saving if item disabled analytics
    const filteredActions = actions.filter(
      (action) => action.item?.settings?.enableSaveActions ?? true,
    );
    if (filteredActions.length === 0) {
      return;
    }

    let view: ViewOptions = View.Unknown;
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
    const completeActions = filteredActions.map((a) => ({
      accountId: actor?.id,
      geolocation: geolocation ?? undefined,
      view,
      itemId: a.item?.id,
      ...a,
      extra: a.extra ?? {},
    }));

    await this.actionRepository.postMany(dbConnection, completeActions);
  }
}
