import { FastifyBaseLogger } from 'fastify';

import { MemberNotFound, UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { Actor } from '../../../member/entities/member';

export class MemberProfileService {
  log: FastifyBaseLogger;

  constructor(log) {
    this.log = log;
  }

  async post(member: Actor, repositories: Repositories, data) {
    const { memberProfileRepository } = repositories;
    if (!member?.id) {
      throw new UnauthorizedMember();
    }
    const profile = await memberProfileRepository.createOne({ ...data, member });
    return profile;
  }
  async get(memberId: string, repositories: Repositories) {
    const { memberProfileRepository } = repositories;
    const memberProfile = await memberProfileRepository.getByMemberId(memberId, {
      visibility: true,
    });
    // to throw error only if member is invisible
    if (!memberProfile) {
      throw new MemberNotFound(memberId);
    }
    return memberProfile;
  }
  async getOwn(member: Actor, repositories: Repositories) {
    const { memberProfileRepository } = repositories;
    if (!member?.id) {
      throw new UnauthorizedMember();
    }
    const memberProfile = await memberProfileRepository.getByMemberId(member.id);
    return memberProfile;
  }
  async patch(member: Actor, repositories: Repositories, data) {
    const { memberProfileRepository } = repositories;

    if (!member?.id) {
      throw new UnauthorizedMember();
    }

    return memberProfileRepository.patch(member.id, data);
  }
}
