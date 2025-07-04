import { faker } from '@faker-js/faker';
import { v4 } from 'uuid';

import type { MemberProfileRaw } from '../../src/drizzle/types';

export const MemberProfileFactory = (
  options: Partial<MemberProfileRaw> & Pick<MemberProfileRaw, 'memberId'>,
): MemberProfileRaw => {
  return {
    id: v4(),
    visibility: true,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    twitterId: faker.word.sample(1),
    facebookId: faker.word.sample(1),
    linkedinId: faker.word.sample(1),
    bio: faker.person.bio(),
    ...options,
  };
};
