import { singleton } from 'tsyringe';

import { UUID } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { MinimalMember } from '../../../../types';
import { MemberProfileRepository } from './memberProfile.repository';
import { IMemberProfile } from './types';

@singleton()
export class MemberProfileService {
  private readonly memberProfileRepository: MemberProfileRepository;

  constructor(memberProfileRepository: MemberProfileRepository) {
    this.memberProfileRepository = memberProfileRepository;
  }

  async post(db: DBConnection, member: MinimalMember, data: IMemberProfile) {
    const profile = await this.memberProfileRepository.createOne(db, member.id, data);
    return profile;
  }

  async get(db: DBConnection, memberId: UUID) {
    const memberProfile = await this.memberProfileRepository.getByMemberId(db, memberId, true);
    // profile is not visible, return 200 and null data
    if (!memberProfile) {
      return null;
    }
    return memberProfile;
  }

  async getOwn(db: DBConnection, member: MinimalMember) {
    const memberProfile = await this.memberProfileRepository.getOwn(db, member.id);
    return memberProfile;
  }

  async patch(db: DBConnection, member: MinimalMember, data: Partial<IMemberProfile>) {
    return await this.memberProfileRepository.patch(db, member.id, data);
  }
}
