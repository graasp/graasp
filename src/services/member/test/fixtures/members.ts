import { DEFAULT_LANG, MemberType } from '@graasp/sdk';

import { Member } from '../../entities/member';
import MemberRepository from '../../repository';

export const saveMember = async (m: Partial<Member>) => {
  const member = MemberRepository.create(m);
  const savedMember = await MemberRepository.save(member);

  return savedMember;
};

export const saveMembers = async (members: Partial<Member>[]) => {
  const promises = members.map((m) => saveMember(m));
  return Promise.all(promises);
};

export const expectMember = (
  m: Member | undefined | null,
  validation: Partial<Member> & Pick<Member, 'name' | 'email'>,
) => {
  if (!m) {
    throw 'member does not exist';
  }
  expect(m.name).toEqual(validation.name);
  expect(m.email).toEqual(validation.email);
  expect(m.type).toEqual(validation.type ?? MemberType.Individual);
  expect(m.extra).toEqual(validation.extra ?? { lang: DEFAULT_LANG });
};

export const expectMinimalMember = (
  m: Member | undefined | null,
  validation: Partial<Member> & Pick<Member, 'name' | 'email'>,
) => {
  if (!m) {
    throw 'member does not exist';
  }
  expect(m.name).toEqual(validation.name);
  expect(m.email).toEqual(validation.email);
};

export const ANNA = { name: 'anna', email: 'anna@email.org' };

export const BOB = { name: 'bob', email: 'bob@email.org', extra: { lang: 'fr' } };

export const CEDRIC = { name: 'cedric', email: 'cedric@email.org', extra: { favoriteItems: [] } };

export const LOUISA = {
  name: 'louisa',
  email: 'louisa@email.org',
  extra: { lang: 'fr' },
};

export const MEMBERS = [ANNA, BOB, LOUISA];
