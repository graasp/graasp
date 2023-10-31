import { v4 } from 'uuid';

import { Member } from '@graasp/sdk';

import { AppDataSource } from '../../plugins/datasource';
import { ItemNotFound } from '../../utils/errors';
import { IMemberProfile } from './controller';
import { MemberProfile } from './entities/profile';

const MemberProfileRepository = AppDataSource.getRepository(MemberProfile).extend({
  async createOne(
    args: IMemberProfile & {
      member: Member;
    },
  ) {
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

  async getByMemberId(memberId: string) {
    const memberProfile = await this.findOne({
      where: { member: { id: memberId }, visibility: true },
      relations: ['member'],
    });

    if (!memberProfile) {
      throw new ItemNotFound(memberId);
    }
    return memberProfile;
  },
  async get(id: string) {
    const memberProfile = await this.findOne({
      where: { id },
      relations: ['member'],
    });

    return memberProfile;
  },
  async patch(id: string, data: Partial<IMemberProfile>) {
    await this.update(id, data);
  },
});

export default MemberProfileRepository;
