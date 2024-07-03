import { EntityManager, Repository } from 'typeorm';
import { v4 } from 'uuid';

import { Member } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { MemberNotFound } from '../../../../utils/errors';
import { MemberProfile } from './entities/profile';
import { IMemberProfile } from './types';

class MemberProfileRepository {
  private repository: Repository<MemberProfile>;

  constructor(manager?: EntityManager) {
    if (manager) {
      this.repository = manager.getRepository(MemberProfile);
    } else {
      this.repository = AppDataSource.getRepository(MemberProfile);
    }
  }

  async createOne(
    args: IMemberProfile & {
      member: Member;
    },
  ): Promise<MemberProfile> {
    const { bio, visibility = false, facebookID, linkedinID, twitterID, member } = args;

    const id = v4();

    const memberProfile = await this.repository.create({
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
    const {
      raw: [profile],
    } = await this.repository
      .createQueryBuilder()
      .update(MemberProfile)
      .set(data)
      .where('member.id = :memberId', { memberId })
      .returning('*')
      .execute();

    console.log(profile);
    return profile;
    // await this.repository.update({ member: { id: memberId } }, data);
    // const profile = await this.repository.findOneBy({ member: { id: memberId } });
    // return profile;
    // return null;
  }
}

export default MemberProfileRepository;
