import { v4 } from 'uuid';

import { Member } from '@graasp/sdk';

import { AppDataSource } from '../../plugins/datasource';
import { MemberProfile } from './entities/profile';
import { IMemberProfile } from './types';

interface ProfileFilter {
  visibility: boolean;
}
const MemberProfileRepository = AppDataSource.getRepository(MemberProfile).extend({
  async createOne(
    args: IMemberProfile & {
      member: Member;
    },
  ): Promise<MemberProfile> {
    const { bio, visibility = false, facebookLink, linkedinLink, twitterLink, member } = args;

    const id = v4();

    const memberProfile = await this.create({
      id,
      bio,
      visibility,
      facebookLink,
      linkedinLink,
      twitterLink,
      member,
    });
    await this.insert(memberProfile);
    return memberProfile;
  },

  async getByMemberId(memberId: string, filter?: ProfileFilter): Promise<MemberProfile> {
    const memberProfile = await this.findOne({
      where: { member: { id: memberId }, ...filter },
      relations: ['member'],
    });

    return memberProfile;
  },

  async patch(memberId: string, data: Partial<IMemberProfile>): Promise<void> {
    await this.update({ member: { id: memberId } }, data);
  },
});

export default MemberProfileRepository;
