import { faker } from '@faker-js/faker';

import { AccountRaw, GuestRaw, MemberRaw } from '../../src/drizzle/types';
import { AccountType, AccountTypeOptions } from '../../src/types';

export function AccountFactory(account: Partial<AccountRaw> = {}) {
  return { id: faker.string.uuid(), name: faker.person.fullName(), ...account };
}

function BaseAccountFactory<T extends AccountTypeOptions>(
  baseAccount: Partial<AccountRaw> & { type: T },
) {
  return {
    ...AccountFactory(baseAccount),
    createdAt: faker.date.anytime().toISOString(),
    updatedAt: faker.date.anytime().toISOString(),
    ...baseAccount,
  };
}

export const MemberFactory = (m: Partial<MemberRaw> = {}) => ({
  extra: faker.helpers.arrayElement([{ lang: faker.helpers.arrayElement(['en', 'fr', 'de']) }, {}]),
  ...BaseAccountFactory({ type: AccountType.Individual }),
  email: faker.internet.email().toLowerCase(),
  ...m,
  enableSaveActions: m.enableSaveActions ?? true,
  isValidated: m.isValidated ?? true,
});

export const GuestFactory = (g: Partial<GuestRaw> & Pick<GuestRaw, 'itemLoginSchema'>) => ({
  ...BaseAccountFactory({ type: AccountType.Guest }),
  ...g,
});
