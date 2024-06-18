import { v4 } from 'uuid';

import { Member } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource.js';
import { MemberNotFound } from '../../../../utils/errors.js';
import { MemberProfile } from './entities/profile.js';
import { IMemberProfile } from './types.js';

const MemberProfileRepository = AppDataSource.getRepository(MemberProfile).extend({
  async createOne(
    args: IMemberProfile & {
      member: Member;
    },
  ): Promise<MemberProfile> {
    const { bio, visibility = false, facebookID, linkedinID, twitterID, member } = args;

    const id = v4();

    const memberProfile = await this.create({
      id,
      bio,
      visibility,
      facebookID,
      linkedinID,
      twitterID,
      member,
    });
    await this.insert(memberProfile);
    return memberProfile;
  },

  async getByMemberId(
    memberId: string,
    filter?: {
      visibility?: boolean;
    },
  ): Promise<MemberProfile | null> {
    if (!memberId) {
      throw new MemberNotFound();
    }
    const memberProfile = await this.findOne({
      where: { member: { id: memberId }, visibility: filter?.visibility },
      relations: ['member'],
    });

    return memberProfile;
  },

  async patch(memberId: string, data: Partial<IMemberProfile>): Promise<void> {
    await this.update({ member: { id: memberId } }, data);
  },
});

export default MemberProfileRepository;
