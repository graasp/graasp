import { FastifyBaseLogger, FastifyInstance } from 'fastify';

import { DEFAULT_LANG } from '@graasp/translations';

import { MemberAlreadySignedUp, MemberNotSignedUp } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { Actor } from '../../../member/entities/member';

export class MobileService {
  private readonly log: FastifyBaseLogger;
  private readonly fastify: FastifyInstance;

  constructor(fastify: FastifyInstance, log: FastifyBaseLogger) {
    this.log = log;
    this.fastify = fastify;
  }

  async register(
    actor: Actor,
    repositories: Repositories,
    {
      name,
      email,
      challenge,
      enableSaveActions,
    }: { name: string; email: string; challenge: string; enableSaveActions?: boolean },
    lang = DEFAULT_LANG,
  ) {
    const { memberRepository } = repositories;

    // check if member w/ email already exists
    const member = await memberRepository.getByEmail(email);

    if (!member) {
      const data = {
        name,
        email,
        extra: { lang },
        enableSaveActions,
      };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const newMember = await memberRepository.post(data);
      await this.fastify.generateRegisterLinkAndEmailIt(newMember, { challenge });
    } else {
      this.log.warn(`Member re-registration attempt for email '${email}'`);
      await this.fastify.generateLoginLinkAndEmailIt(member, { challenge, lang });
      throw new MemberAlreadySignedUp({ email });
    }
  }

  async login(
    actor: Actor,
    repositories: Repositories,
    { email, challenge }: { email: string; challenge: string },
    lang = DEFAULT_LANG,
  ) {
    const { memberRepository } = repositories;

    const member = await memberRepository.getByEmail(email);

    if (member) {
      await this.fastify.generateLoginLinkAndEmailIt(member, { challenge, lang });
    } else {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
  }
}
