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
    email: m.email?.toLowerCase() ?? baseAccount.email?.toLowerCase() ?? uniqueEmail(),
    type: AccountType.Individual,
    isValidated,
  };
};

/**
 * Creates a unique-ish email by appending timestamp + random bytes.
 * Ensures RFC-safe local-part characters and keeps domain from faker.
 * Example output: "john.doe+1731401674001-8f3a@example.com"
 */
export function uniqueEmail() {
  const base = faker.internet.email();
  const [local, domain] = base.split('@');

  const ts = Date.now(); // ms since epoch
  const rand = Math.random().toString(16).slice(2, 6); // short non-crypto random
  const suffix = `${ts}-${rand}`;

  // Use plus addressing to keep domain valid and readable
  const uniqueLocal = `${sanitizeLocal(local)}+${suffix}`;

  return `${uniqueLocal}@${domain}`;
}

function sanitizeLocal(local) {
  // Keep alphanumerics and . _ - only (safe common set)
  return local
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

export const GuestFactory = (g: Partial<GuestRaw> & Pick<GuestRaw, 'itemLoginSchemaId'>) => ({
  ...BaseAccountFactory({ type: AccountType.Guest }),
  ...g,
});
