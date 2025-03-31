import { eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DEFAULT_LANG } from '@graasp/translations';

import { DBConnection } from '../../drizzle/db';
import { accountsTable } from '../../drizzle/schema';
import { AccountRaw } from '../../drizzle/types';
import { AccountType,  MaybeUser } from '../../types';
import { CurrentMember } from '../member/types';

// used by /current endpoint
export type CurrentUser =
  | {
      id: string;
      name: string;
      email: null;
      type: 'guest';
      isValidated: boolean;
      lang: string;
      createdAt: string;
      updatedAt: string;
      lastAuthenticatedAt: string | null;
      userAgreementsDate: string | null;
      // TODO: fix
      extra: object;
      enableSaveActions: boolean;
      // add any necessary properties here
    }
  | CurrentMember;

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
      // TODO: what should be the default for this ? Why could it be null ? can we enforce a value ??
      enableSaveActions: this.account.enableSaveActions ?? true,
    };
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
