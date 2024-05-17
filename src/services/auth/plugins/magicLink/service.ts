import jwt, { JsonWebTokenError, Secret, TokenExpiredError, VerifyOptions } from 'jsonwebtoken';
import { promisify } from 'util';

import { FastifyBaseLogger, FastifyInstance } from 'fastify';

import { ActionTriggers, Context } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { JWT_SECRET } from '../../../../utils/config';
import {
  InvalidToken,
  MemberNotSignedUp,
  TokenExpired,
  UnexpectedError,
} from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { Actor, Member } from '../../../member/entities/member';

/** @deprecated */
const promisifiedJwtVerify = promisify<
  string,
  Secret,
  VerifyOptions,
  { sub: string; challenge?: string }
>(jwt.verify);

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

  /** @deprecated */
  async auth(_actor: Actor, repositories: Repositories, token: string) {
    try {
      // verify and extract member info
      const result = await promisifiedJwtVerify(token, JWT_SECRET, {});
      const { sub: memberId } = result;
      // pre test the user existence to avoid providing a key
      // throw if no member is found
      await repositories.memberRepository.get(memberId);

      return result;
    } catch (error) {
      // the token caused the error
      if (error instanceof JsonWebTokenError) {
        // return a custom error when the token expired
        // helps the client know when to request a refreshed token
        if (error instanceof TokenExpiredError) {
          throw new TokenExpired();
        }

        throw new InvalidToken();
      }
      throw new UnexpectedError();
    }
  }
}
