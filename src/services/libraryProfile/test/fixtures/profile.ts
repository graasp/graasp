import { v4 as uuidv4 } from 'uuid';

import { Member } from '../../../member/entities/member';
import { saveMember } from '../../../member/test/fixtures/members';
import { IMemberProfile } from '../../controller';
import { MemberProfile } from '../../entities/profile';

export const getDummyProfile = (options: Partial<MemberProfile>): MemberProfile => {
  const {
    bio,
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
  } as MemberProfile;
};

export const saveMemberProfile = async (m: Partial<Member>, profile: IMemberProfile) => {
  const member = await saveMember(m);
  const memberProfile = MemberProfile.create({ ...profile, member });
  const savedMember = await MemberProfile.save(memberProfile);

  return savedMember;
};

export const ANNA = {
  name: 'anna',
  email: 'anna@email.org',
  createdAt: new Date(),
  updatedAt: new Date(),
};

export const ANNA_PROFILE = {
  bio: 'Hi, ITs Anna, an english teacher',
  facebookLink: 'https://facebook.com/anna',
  twitterLink: '',
  linkedinLink: 'https://linkedin.com/anna',
};
export const BOB = {
  name: 'bob',
  email: 'bob@email.org',
  extra: { lang: 'fr' },
  createdAt: new Date(),
  updatedAt: new Date(),
};
export const BOB_PROFILE = {
  bio: 'Hi, ITs Bob, a science teacher',
  facebookLink: 'https://facebook.com/bob',
  twitterLink: '',
  linkedinLink: 'https://linkedin.com/bob',
  visibility: true,
};
