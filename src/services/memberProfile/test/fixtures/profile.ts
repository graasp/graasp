import { v4 as uuidv4 } from 'uuid';

import { Member } from '../../../member/entities/member';
import { saveMember } from '../../../member/test/fixtures/members';
import { MemberProfile } from '../../entities/profile';
import { IMemberProfile } from '../../types';

export const getDummyProfile = (options: Partial<MemberProfile>): Partial<MemberProfile> => {
  const {
    bio = '',
    facebookLink = '',
    twitterLink = '',
    linkedinLink = '',
    id,
    visibility = false,
  } = options;
  const buildId = id ?? uuidv4();

  return {
    id: buildId,
    bio,
    facebookLink,
    twitterLink,
    visibility,
    linkedinLink,
    updatedAt: new Date(),
    createdAt: new Date(),
  };
};

export const saveMemberProfile = async (m: Partial<Member>, profile: IMemberProfile) => {
  const member = await saveMember(m);
  const memberProfile = MemberProfile.create({ ...profile, member });
  const savedMember = await MemberProfile.save(memberProfile);

  return savedMember;
};

export const getMemberProfile = async (id: string) => {
  const profile = MemberProfile.findOneBy({ id });

  return profile;
};

export const ANNA_PROFILE = {
  bio: "Hi, I'm Anna, an english teacher",
  facebookLink: 'https://facebook.com/anna',
  twitterLink: '',
  linkedinLink: 'https://linkedin.com/anna',
};

export const BOB_PROFILE = {
  bio: "Hi, I'm Bob, a science teacher",
  facebookLink: 'https://facebook.com/bob',
  twitterLink: '',
  linkedinLink: 'https://linkedin.com/bob',
  visibility: true,
};
