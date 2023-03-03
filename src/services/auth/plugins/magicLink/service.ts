import { JsonWebTokenError } from 'jsonwebtoken';
import jwt, { Secret, TokenExpiredError, VerifyOptions } from 'jsonwebtoken';
import { promisify } from 'util';

import { FastifyInstance } from 'fastify';
import { FastifyLoggerInstance } from 'fastify';

import { DEFAULT_LANG } from '@graasp/sdk';

import { JWT_SECRET } from '../../../../util/config';
import {
  InvalidToken,
  MemberAlreadySignedUp,
  MemberNotSignedUp,
  TokenExpired,
  UnexpectedError,
} from '../../../../util/graasp-error';
import { Repositories } from '../../../../util/repositories';
import { Member } from '../../../member/entities/member';

const promisifiedJwtVerify = promisify<
  string,
  Secret,
  VerifyOptions,
  { sub: string; challenge?: string }
>(jwt.verify);

export class MagicLinkService {
  log: FastifyLoggerInstance;
  fastify: FastifyInstance;

  constructor(fastify, log) {
    this.fastify = fastify;
    this.log = log;
  }

  async sendRegisterMail(actor, repositories: Repositories, member: Member) {
    await this.fastify.generateRegisterLinkAndEmailIt(member);
  }

  async login(actor, repositories: Repositories, body, lang = DEFAULT_LANG) {
    const { memberRepository } = repositories;
    const { email } = body;
    const member = await memberRepository.getByEmail(email);

    if (member) {
      await this.fastify.generateLoginLinkAndEmailIt(member, null, null, lang);
    } else {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
  }

  async auth(actor, repositories: Repositories, token) {
    try {
      // verify and extract member info
      const result = await promisifiedJwtVerify(token, JWT_SECRET, {});
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
