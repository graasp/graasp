import { eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DEFAULT_LANG } from '@graasp/translations';

import type { DBConnection } from '../../drizzle/db';
import { accountsTable } from '../../drizzle/schema';
import type { AccountRaw } from '../../drizzle/types';
import { AccountType, type MaybeUser } from '../../types';

export class AccountDTO {
  private readonly account: AccountRaw | undefined;

  static from(account: AccountRaw | undefined): AccountDTO {
    return new this(account);
  }

  constructor(account: AccountRaw | undefined) {
    this.account = account;
  }

  get type() {
    return this.account?.type;
  }

  get hasAvatar() {
    return this.account?.extra.hasAvatar ?? false;
  }

  exists(): boolean {
    return Boolean(this.account);
  }

  toMaybeUser(): MaybeUser {
    if (this.account) {
      if (this.account.type === AccountType.Individual) {
        return {
          id: this.account.id,
          name: this.account.name,
          type: AccountType.Individual,
          isValidated: this.account.isValidated ?? false,
        };
      } else {
        return {
          id: this.account.id,
          name: this.account.name,
          type: AccountType.Guest,
        };
      }
    }
    return undefined;
  }

  // used by /current endpoint
  toCurrent() {
    if (!this.account) {
      return undefined;
    }
    return {
      id: this.account.id,
      name: this.account.name,
      type: this.account.type,
      isValidated: this.account.isValidated ?? false,
      email: this.account.email,
      lang: this.account.extra.lang ?? DEFAULT_LANG,
      createdAt: this.account.createdAt,
      updatedAt: this.account.updatedAt,
      lastAuthenticatedAt: this.account.lastAuthenticatedAt,
      userAgreementsDate: this.account.userAgreementsDate,
      extra: this.account.extra,
      enableSaveActions: this.account.enableSaveActions ?? true,
    };
  }
}

@singleton()
export class AccountRepository {
  async get(dbConnection: DBConnection, id: string): Promise<AccountDTO> {
    const result = await dbConnection.query.accountsTable.findFirst({
      where: eq(accountsTable.id, id),
    });

    return new AccountDTO(result);
  }
}
