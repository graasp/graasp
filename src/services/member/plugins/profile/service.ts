import { UUID } from '@graasp/sdk';

import { db } from '../../../../drizzle/db';
import { Member } from '../../../member/entities/member';
import { MemberProfileRepository } from './repository';
import { IMemberProfile } from './types';

export class MemberProfileService {
  private readonly memberProfileRepository: MemberProfileRepository;

  constructor(memberProfileRepository: MemberProfileRepository) {
    this.memberProfileRepository = memberProfileRepository;
  }

  async post(member: Member, data: IMemberProfile) {
    const profile = await this.memberProfileRepository.createOne(db, member.id, data);
    return profile;
  }

  async get(memberId: UUID) {
    const memberProfile = await this.memberProfileRepository.getByMemberId(db, memberId, true);
    // profile is not visible, return 200 and null data
    if (!memberProfile) {
      return null;
    }
    return memberProfile;
  }

  async getOwn(member: Member) {
    const memberProfile = await this.memberProfileRepository.getOwn(db, member.id);
    return memberProfile;
  }

  async patch(member: Member, data: Partial<IMemberProfile>) {
    return await this.memberProfileRepository.patch(db, member.id, data);
  }
}
