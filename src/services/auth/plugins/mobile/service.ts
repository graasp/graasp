import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt, { Secret, SignOptions, TokenExpiredError, VerifyOptions } from 'jsonwebtoken';
import { JsonWebTokenError } from 'jsonwebtoken';
import { promisify } from 'util';

import { FastifyBaseLogger, FastifyInstance, FastifyLoggerInstance } from 'fastify';

import { DEFAULT_LANG } from '@graasp/sdk';

import { JWT_SECRET } from '../../../../utils/config';
import {
  ChallengeFailed,
  InvalidToken,
  MemberAlreadySignedUp,
  MemberNotSignedUp,
  TokenExpired,
} from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { Actor } from '../../../member/entities/member';

const promisifiedJwtVerify = promisify<
  string,
  Secret,
  VerifyOptions,
  { sub: string; challenge?: string }
>(jwt.verify);

export class MobileService {
  log: FastifyBaseLogger;
  fastify: FastifyInstance;

  constructor(fastify: FastifyInstance, log: FastifyBaseLogger) {
    this.log = log;
    this.fastify = fastify;
  }

  async register(
    actor: Actor,
    repositories: Repositories,
    { name, email, challenge }: { name: string; email: string; challenge: string },
    lang = DEFAULT_LANG,
  ) {
    const { memberRepository } = repositories;

    // check if member w/ email already exists
    const member = await memberRepository.getByEmail(email);

    if (!member) {
      const newMember = {
        name,
        email,
        extra: { lang },
      };
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      await memberRepository.post(newMember);
      await this.fastify.generateRegisterLinkAndEmailIt(newMember, challenge);
    } else {
      this.log.warn(`Member re-registration attempt for email '${email}'`);
      await this.fastify.generateLoginLinkAndEmailIt(member, challenge, lang);
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
      await this.fastify.generateLoginLinkAndEmailIt(member, challenge, lang);
    } else {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }
  }

  async auth(actor: Actor, repositories: Repositories, token: string, verifier: string) {
    try {
      const { sub: memberId, challenge } = await promisifiedJwtVerify(token, JWT_SECRET, {});

      const verifierHash = crypto.createHash('sha256').update(verifier).digest('hex');
      if (challenge !== verifierHash) {
        throw new ChallengeFailed();
      }

      // TODO: should we fetch/test the member from the DB?
      return this.fastify.generateAuthTokensPair(memberId);
    } catch (error) {
      if (error instanceof JsonWebTokenError) {
        // return a custom error when the token expired
        // helps the client know when to request a refreshed token
        if (error instanceof TokenExpiredError) {
          throw new TokenExpired();
        }
        throw new InvalidToken();
      }
      throw error;
    }
  }
}
