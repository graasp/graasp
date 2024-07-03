import { FastifyBaseLogger } from 'fastify';

import { UUID } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Actor, Member } from '../../../member/entities/member';
import { IMemberProfile } from './types';

export class MemberProfileService {
  private log: FastifyBaseLogger;

  constructor(log: FastifyBaseLogger) {
    this.log = log;
  }

  async post(member: Member, { memberProfileRepository }: Repositories, data: IMemberProfile) {
    const profile = await memberProfileRepository.createOne({ ...data, member });
    return profile;
  }

  async get(_actor: Actor, { memberProfileRepository }: Repositories, memberId: UUID) {
    const memberProfile = await memberProfileRepository.getByMemberId(memberId, {
      visibility: true,
    });
    // profile is not visible, return 200 and null data
    if (!memberProfile) {
      return null;
    }
    return memberProfile;
  }

  async getOwn(member: Member, { memberProfileRepository }: Repositories) {
    const memberProfile = await memberProfileRepository.getByMemberId(member.id);
    return memberProfile;
  }

  async patch(
    member: Member,
    { memberProfileRepository }: Repositories,
    data: Partial<IMemberProfile>,
  ) {
    return memberProfileRepository.patch(member.id, data);
  }
}
