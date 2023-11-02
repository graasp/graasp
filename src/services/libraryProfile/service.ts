import { FastifyBaseLogger } from 'fastify';

import { UnauthorizedMember } from '../../utils/errors';
import { Repositories } from '../../utils/repositories';
import { Member } from '../member/entities/member';

export class MemberProfileService {
  log: FastifyBaseLogger;

  constructor(log) {
    this.log = log;
  }

  async post(data, repositories: Repositories, member: Member | undefined) {
    const { memberProfileRepository } = repositories;
    const d = await memberProfileRepository.createOne({ ...data, member });
    return d;
  }
  async get(memberId, repositories: Repositories) {
    const { memberProfileRepository } = repositories;
    const memberProfile = await memberProfileRepository.getByMemberId(memberId);
    return memberProfile;
  }
  async getOwn(memberId, repositories: Repositories) {
    const { memberProfileRepository } = repositories;
    if (!memberId) {
      throw new UnauthorizedMember();
    }
    const memberProfile = await memberProfileRepository.getMember(memberId);
    return memberProfile;
  }
  async patch(data, repositories: Repositories, member: Member | undefined) {
    const { memberProfileRepository } = repositories;

    if (!member?.id) {
      throw new UnauthorizedMember();
    }

    return await memberProfileRepository.patch(member.id, data);
  }
}
