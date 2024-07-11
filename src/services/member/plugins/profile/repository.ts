import { EntityManager } from 'typeorm';
import { v4 } from 'uuid';

import { Member } from '@graasp/sdk';

import { AbstractRepository } from '../../../../repository';
import { MemberNotFound } from '../../../../utils/errors';
import { MemberProfile } from './entities/profile';
import { IMemberProfile } from './types';

class MemberProfileRepository extends AbstractRepository<MemberProfile> {
  constructor(manager?: EntityManager) {
    super(MemberProfile, manager);
  }

  async createOne(member: Member, payload: IMemberProfile): Promise<MemberProfile> {
    const { bio, visibility = false, facebookID, linkedinID, twitterID } = payload;

    const id = v4();

    const memberProfile = this.repository.create({
      id,
      bio,
      visibility,
      facebookID,
      linkedinID,
      twitterID,
      member,
    });
    await this.repository.insert(memberProfile);
    return memberProfile;
  }

  async getByMemberId(
    memberId: string,
    filter?: {
      visibility?: boolean;
    },
  ): Promise<MemberProfile | null> {
    if (!memberId) {
      throw new MemberNotFound();
    }
    const memberProfile = await this.repository.findOne({
      where: { member: { id: memberId }, visibility: filter?.visibility },
      relations: ['member'],
    });

    return memberProfile;
  }

  async patch(memberId: string, data: Partial<IMemberProfile>): Promise<MemberProfile | null> {
    await this.repository.update({ member: { id: memberId } }, data);
    const profile = await this.repository.findOneByOrFail({ member: { id: memberId } });

    return profile;
  }
}

export default MemberProfileRepository;
