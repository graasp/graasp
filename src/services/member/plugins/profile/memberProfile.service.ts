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

  async post(dbConnection: DBConnection, member: MinimalMember, data: Partial<IMemberProfile>) {
    const profile = await this.memberProfileRepository.createOne(dbConnection, member.id, data);

    return profile;
  }

  async get(dbConnection: DBConnection, memberId: UUID) {
    const memberProfile = await this.memberProfileRepository.getByMemberId(
      dbConnection,
      memberId,
      true,
    );
    // profile is not visible, return 200 and null data
    if (!memberProfile) {
      return null;
    }
    return memberProfile;
  }

  async getOwn(dbConnection: DBConnection, member: MinimalMember) {
    const memberProfile = await this.memberProfileRepository.getOwn(dbConnection, member.id);
    return memberProfile;
  }

  async patch(dbConnection: DBConnection, member: MinimalMember, data: Partial<IMemberProfile>) {
    return await this.memberProfileRepository.patch(dbConnection, member.id, data);
  }
}
