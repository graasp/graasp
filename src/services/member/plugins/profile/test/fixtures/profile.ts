import { v4 as uuidv4 } from 'uuid';

import { CompleteMember } from '@graasp/sdk';

import { MemberProfileRaw } from '../../../../../../drizzle/types.js';
import { saveMember } from '../../../../test/fixtures/members.js';
import { IMemberProfile } from '../../types.js';

export const getDummyProfile = (options: Partial<MemberProfileRaw>): Partial<MemberProfileRaw> => {
  const {
    bio = '',
    facebookID = '',
    twitterID = '',
    linkedinID = '',
    id,
    visibility = false,
  } = options;
  const buildId = id ?? uuidv4();

  return {
    id: buildId,
    bio,
    facebookID,
    twitterID,
    visibility,
    linkedinID,
    updatedAt: new Date(),
    createdAt: new Date(),
  };
};

export const saveMemberProfile = async (m: CompleteMember, profile: IMemberProfile) => {
  const member = await saveMember(m);
  const memberProfile = MemberProfile.create({ ...profile, member });
  const savedMemberProfile = await MemberProfile.save(memberProfile);

  return savedMemberProfile;
};

export const getMemberProfile = async (id: string) => {
  const profile = await MemberProfile.findOneBy({ id });
  if (!profile) {
    throw new Error('Unable to find profile, but it should exist');
  }
  return profile;
};

export const ANNA_PROFILE: IMemberProfile = {
  bio: "Hi, I'm Anna, an english teacher",
  facebookID: 'anna',
  twitterID: '',
  linkedinID: 'anna',
  visibility: false,
};

export const BOB_PROFILE: IMemberProfile = {
  bio: "Hi, I'm Bob, a science teacher",
  facebookID: 'bob',
  twitterID: '',
  linkedinID: 'bob',
  visibility: true,
};
