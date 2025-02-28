import { AccountType, CompleteMember, MemberFactory } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { db } from '../../../../drizzle/db';
import { Member, accountsTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { Account } from '../../../account/entities/account';

export const saveMember = async (m: CompleteMember = MemberFactory()) => {
  // using accounts table since member is just a view and we can not insert on views
  const res = await db
    .insert(accountsTable)
    .values({ ...m, email: m.email.toLowerCase() })
    .returning();
  const savedMember = res[0];
  assertIsDefined(savedMember);
  // ensure member email is typed as string and not null
  const email = savedMember.email;
  if (!email) {
    throw new Error('saved member email is not defined');
  }
  // this ensures the type of the email property is `string` and not `string | null`
  return { ...savedMember, email };
};

export const saveMembers = async (
  members: CompleteMember[] = [
    MemberFactory(),
    MemberFactory(),
    MemberFactory(),
  ],
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
  expect(m.type).toEqual(validation.type ?? AccountType.Individual);
  expect(m.extra).toEqual(validation.extra ?? { lang: DEFAULT_LANG });
};

export const expectAccount = (
  m: Account | undefined | null,
  validation: Partial<Account> & Pick<Account, 'name' | 'id'>,
) => {
  if (!m) {
    throw 'member does not exist';
  }
  expect(m.name).toEqual(validation.name);
  expect(m.id).toEqual(validation.id);
};
