import { FastifyLoggerInstance } from 'fastify';

import { LOGIN_TOKEN_EXPIRATION_IN_MINUTES } from '../../../../utils/config';
import { MemberWithoutPassword } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { generateToken } from '../../token';

export class MemberPasswordService {
  log: FastifyLoggerInstance;

  constructor(log) {
    this.log = log;
  }

  async patch(actor, repositories: Repositories, newPassword: string, currentPassword?: string) {
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
    actor,
    repositories: Repositories,
    body: { email: string; password: string },
    challenge?: string,
  ) {
    const { memberRepository, memberPasswordRepository } = repositories;

    const member = await memberRepository.getByEmail(body.email, { shouldExist: true });

    const memberPassword = await memberPasswordRepository.getForMemberId(member.id);
    if (!memberPassword) {
      throw new MemberWithoutPassword({ email: body.email });
    }

    // validate credentials to build token
    await memberPasswordRepository.validateCredentials(memberPassword, body);

    const token = await generateToken(
      { sub: member.id, challenge },
      `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
    );

    return token;
  }
}
