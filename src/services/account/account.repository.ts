import { eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../drizzle/db';
import { accountsTable } from '../../drizzle/schema';
import { AccountRaw } from '../../drizzle/types';
import { AccountType, MaybeUser } from '../../types';

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
}

@singleton()
export class AccountRepository {
  async get(db: DBConnection, id: string): Promise<AccountDTO> {
    const result = await db.query.accountsTable.findFirst({
      where: eq(accountsTable.id, id),
    });

    return new AccountDTO(result);
  }
}
