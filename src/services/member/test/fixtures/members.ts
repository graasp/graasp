import { AccountType } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { Account, MemberRaw } from '../../../../drizzle/types';

export const expectMember = (
  m: MemberRaw | undefined | null,
  expectation: Partial<Pick<MemberRaw, 'type' | 'extra'>> & Pick<MemberRaw, 'name' | 'email'>,
) => {
  if (!m) {
    throw 'member does not exist';
  }
  expect(m.name).toEqual(expectation.name);
  expect(m.email).toEqual(expectation.email);
  expect(m.type).toEqual(expectation.type ?? AccountType.Individual);
  expect(m.extra).toEqual(expectation.extra ?? { lang: DEFAULT_LANG });
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
