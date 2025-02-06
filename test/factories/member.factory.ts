import { faker } from '@faker-js/faker';

import { AccountType } from '@graasp/sdk';

import { Account } from '../../src/services/account/entities/account';
import { Guest } from '../../src/services/itemLogin/entities/guest';
import { Member } from '../../src/services/member/entities/member';

export function AccountFactory(account: Partial<Account> = {}) {
  return { id: faker.string.uuid(), name: faker.person.fullName(), ...account };
}

function BaseAccountFactory<T extends AccountType>(baseAccount: Partial<Account> & { type: T }) {
  return {
    ...AccountFactory(baseAccount),
    createdAt: faker.date.anytime(),
    updatedAt: faker.date.anytime(),
    ...baseAccount,
  };
}

export const MemberFactory = (m: Partial<Member> = {}) => ({
  email: faker.internet.email().toLowerCase(),
  extra: faker.helpers.arrayElement([{ lang: faker.helpers.arrayElement(['en', 'fr', 'de']) }, {}]),
  enableSaveActions: m.enableSaveActions ?? true,
  isValidated: m.isValidated ?? true,
  ...BaseAccountFactory({ type: AccountType.Individual }),
  ...m,
});

export const GuestFactory = (g: Partial<Guest> & Pick<Guest, 'itemLoginSchema'>) => ({
  ...BaseAccountFactory({ type: AccountType.Guest }),
  ...g,
});
