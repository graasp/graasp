import { faker } from '@faker-js/faker';

import type { AccountRaw, GuestRaw, MemberRaw } from '../../src/drizzle/types';
import { AccountType, type AccountTypeOptions } from '../../src/types';

export function AccountFactory(account: Partial<AccountRaw> = {}) {
  return { id: faker.string.uuid(), name: faker.person.fullName(), ...account };
}

function BaseAccountFactory<T extends AccountTypeOptions>(
  baseAccount: Partial<AccountRaw> & { type: T },
) {
  return {
    ...AccountFactory(baseAccount),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.past().toISOString(),
    ...baseAccount,
  };
}

export const MemberFactory = (m: Partial<AccountRaw> = {}): MemberRaw => {
  const isValidated = m.isValidated ?? true;
  const baseAccount = BaseAccountFactory({
    type: AccountType.Individual,
  });
  return {
    extra: faker.helpers.arrayElement([
      { lang: faker.helpers.arrayElement(['en', 'fr', 'de']) },
      {},
    ]),
    enableSaveActions: m.enableSaveActions ?? true,
    lastAuthenticatedAt: isValidated
      ? (m.lastAuthenticatedAt ?? faker.date.past().toISOString())
      : null,
    userAgreementsDate: m.userAgreementsDate ?? faker.date.past().toISOString(),
    ...baseAccount,
    ...m,
    email:
      m.email?.toLowerCase() ??
      baseAccount.email?.toLowerCase() ??
      faker.internet.email().toLowerCase(),
    type: AccountType.Individual,
    isValidated,
  };
};

export const GuestFactory = (g: Partial<GuestRaw> & Pick<GuestRaw, 'itemLoginSchemaId'>) => ({
  ...BaseAccountFactory({ type: AccountType.Guest }),
  ...g,
});
