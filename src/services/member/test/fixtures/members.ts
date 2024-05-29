import { CompleteMember, MemberFactory, MemberType } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { AppDataSource } from '../../../../plugins/datasource';
import { Member } from '../../entities/member';

export const saveMember = async (m: CompleteMember = MemberFactory()) => {
  const rawRepository = AppDataSource.getRepository(Member);
  const savedMember = await rawRepository.save({ ...m, email: m.email.toLowerCase() });
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
