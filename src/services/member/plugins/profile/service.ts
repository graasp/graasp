import { UUID } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Member } from '../../../member/entities/member';
import { IMemberProfile } from './types';

export class MemberProfileService {
  async post(member: Member, { memberProfileRepository }: Repositories, data: IMemberProfile) {
    const profile = await memberProfileRepository.createOne(member, data);
    return profile;
  }

  async get({ memberProfileRepository }: Repositories, memberId: UUID) {
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
