import { v4 } from 'uuid';

import { Member } from '@graasp/sdk';

import { AppDataSource } from '../../plugins/datasource';
import { MemberNotFound } from '../../utils/errors';
import { MemberProfile } from './entities/profile';
import { IMemberProfile } from './types';

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

  async getByMemberId(memberId: string): Promise<MemberProfile> {
    if (!memberId) {
      throw new MemberNotFound(memberId);
    }
    const memberProfile = await this.findOne({
      where: { member: { id: memberId }, visibility: true },
      relations: ['member'],
    });

    if (!memberProfile) {
      throw new MemberNotFound(memberId);
    }
    return memberProfile;
  },
  async get(id: string): Promise<MemberProfile> {
    if (!id) {
      throw new MemberNotFound(id);
    }
    const memberProfile = await this.findOne({
      where: { id },
      relations: ['member'],
    });

    return memberProfile;
  },
  async getMember(id: string): Promise<MemberProfile> {
    if (!id) {
      throw new MemberNotFound(id);
    }
    const memberProfile = await this.findOne({
      where: { member: { id } },
      relations: ['member'],
    });

    return memberProfile;
  },
  async patch(memberId: string, data: Partial<IMemberProfile>): Promise<void> {
    await this.update({ member: { id: memberId } }, data);
  },
});

export default MemberProfileRepository;
