import { FastifyBaseLogger } from 'fastify';

import { MemberNotFound, UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { Actor } from '../../../member/entities/member';
import { IMemberProfile } from './types';

export class MemberProfileService {
  log: FastifyBaseLogger;

  constructor(log: FastifyBaseLogger) {
    this.log = log;
  }

  async post(member: Actor, repositories: Repositories, data: IMemberProfile) {
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
    // profile is not visible, return 200 and null data
    if (!memberProfile) {
      return null;
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

  async patch(member: Actor, repositories: Repositories, data: Partial<IMemberProfile>) {
    const { memberProfileRepository } = repositories;

    if (!member?.id) {
      throw new UnauthorizedMember();
    }

    return memberProfileRepository.patch(member.id, data);
  }
}
