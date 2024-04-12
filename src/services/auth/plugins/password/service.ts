import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { promisify } from 'util';

import { FastifyBaseLogger } from 'fastify';

import { JWT_SECRET, LOGIN_TOKEN_EXPIRATION_IN_MINUTES } from '../../../../utils/config';
import { MemberNotSignedUp, MemberWithoutPassword } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';

const promisifiedJwtSign = promisify<
  { sub: string; challenge?: string },
  Secret,
  SignOptions,
  string
>(jwt.sign);

export class MemberPasswordService {
  log: FastifyBaseLogger;

  constructor(log) {
    this.log = log;
  }

  generateToken(data, expiration) {
    return promisifiedJwtSign(data, JWT_SECRET, {
      expiresIn: expiration,
    });
  }

  async patch(
    actor: Member,
    repositories: Repositories,
    newPassword: string,
    currentPassword?: string,
  ) {
    const { memberPasswordRepository } = repositories;
    // verify that input current password is the same as the stored one
    await memberPasswordRepository.validatePassword(actor.id, currentPassword);
    await memberPasswordRepository.patch(actor.id, newPassword);
  }

  /**
   *
   * @param actor
   * @param repositories
   * @param body
   * @param challenge  used for mobile
   * @returns
   */
  async login(
    actor: undefined,
    repositories: Repositories,
    body: { email: string; password: string },
    challenge?: string,
  ) {
    const { memberRepository, memberPasswordRepository } = repositories;
    const { email } = body;

    const member = await memberRepository.getByEmail(email);
    if (!member) {
      this.log.warn(`Login attempt with non-existent email '${email}'`);
      throw new MemberNotSignedUp({ email });
    }

    const memberPassword = await memberPasswordRepository.getForMemberId(member.id);
    if (!memberPassword) {
      throw new MemberWithoutPassword({ email });
    }

    // validate credentials to build token
    await memberPasswordRepository.validateCredentials(memberPassword, body);

    const token = await this.generateToken(
      { sub: member.id, challenge },
      `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
    );

    return token;
  }
}
