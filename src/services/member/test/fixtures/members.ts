import { CompleteMember, DEFAULT_LANG, MemberFactory, MemberType } from '@graasp/sdk';

import { Member } from '../../entities/member';
import MemberRepository from '../../repository';

export const saveMember = async (m: CompleteMember = MemberFactory()) => {
  const savedMember = await MemberRepository.save({ ...m, email: m.email.toLowerCase() });
  return savedMember;
};

export const saveMembers = async (
  members: CompleteMember[] = [MemberFactory(), MemberFactory(), MemberFactory()],
) => {
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
