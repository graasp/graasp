import { v4 } from 'uuid';

import { Member } from '@graasp/sdk';

import { AppDataSource } from '../../plugins/datasource';
import { IMemberProfile } from './controller';
import { MemberProfile } from './entities/profile';

const MemberProfileRepository = AppDataSource.getRepository(MemberProfile).extend({
  createOne(
    args: IMemberProfile & {
      member: Member;
    },
  ) {
    const { bio, visibility = false, facebookLink, linkedinLink, twitterLink, member } = args;

    const id = v4();

    const memberProfile = this.create({
      id,
      bio,
      visibility,
      facebookLink,
      linkedinLink,
      twitterLink,
      member,
    });

    return memberProfile;
  },
});

export default MemberProfileRepository;
