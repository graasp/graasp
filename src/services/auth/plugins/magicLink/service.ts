import { FastifyBaseLogger, FastifyInstance } from 'fastify';

import { ActionTriggers, Context } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { MemberNotSignedUp } from '../../../../utils/errors.js';
import { Repositories } from '../../../../utils/repositories.js';
import { Actor, Member } from '../../../member/entities/member.js';

export class MagicLinkService {
  log: FastifyBaseLogger;
  fastify: FastifyInstance;

  constructor(fastify, log) {
    this.fastify = fastify;
    this.log = log;
  }

  async sendRegisterMail(actor: Actor, repositories: Repositories, member: Member, url?: string) {
    await this.fastify.generateRegisterLinkAndEmailIt(member, { url });
  }

  async login(actor: Actor, repositories: Repositories, body, lang = DEFAULT_LANG, url?: string) {
    const { memberRepository, actionRepository } = repositories;
    const { email } = body;
    const member = await memberRepository.getByEmail(email);

    if (member) {
      await this.fastify.generateLoginLinkAndEmailIt(member, { lang, url });
      const actions = [
        {
          member,
          type: ActionTriggers.MemberLogin,
          view: Context.Unknown,
          extra: { type: 'email' },
        },
      ];
      await actionRepository.postMany(actions);
    } else {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
  }
}
