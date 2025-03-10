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

export const MemberFactory = (m: Partial<MemberRaw> = {}): MemberRaw => {
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
    isValidated,
    lastAuthenticatedAt: isValidated
      ? (m.lastAuthenticatedAt ?? faker.date.anytime().toISOString())
      : null,
    userAgreementsDate: m.userAgreementsDate ?? faker.date.anytime().toISOString(),
    ...baseAccount,
    ...m,
    email: m.email ?? baseAccount.email ?? faker.internet.email().toLowerCase(),
  };
};

export const GuestFactory = (g: Partial<GuestRaw> & Pick<GuestRaw, 'itemLoginSchemaId'>) => ({
  ...BaseAccountFactory({ type: AccountType.Guest }),
  ...g,
});
