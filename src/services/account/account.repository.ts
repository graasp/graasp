import { eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DEFAULT_LANG } from '@graasp/translations';

import type { DBConnection } from '../../drizzle/db';
import { accountsTable, itemLoginSchemasTable } from '../../drizzle/schema';
import type { AccountRaw, ItemLoginSchemaWithItem } from '../../drizzle/types';
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
    if (this.type === AccountType.Individual) {
      return {
        id: this.account.id,
        name: this.account.name,
        type: 'individual' as const,
        isValidated: this.account.isValidated ?? false,
        email: this.account.email ?? undefined,
        lang: this.account.extra.lang ?? DEFAULT_LANG,
        createdAt: this.account.createdAt,
        updatedAt: this.account.updatedAt,
        lastAuthenticatedAt: this.account.lastAuthenticatedAt,
        userAgreementsDate: this.account.userAgreementsDate,
        extra: this.account.extra,
        enableSaveActions: this.account.enableSaveActions ?? true,
      };
    }
    return {
      id: this.account.id,
      name: this.account.name,
      type: 'guest' as const,
      createdAt: this.account.createdAt,
      updatedAt: this.account.updatedAt,
      lastAuthenticatedAt: this.account.lastAuthenticatedAt,
      itemLoginSchemaId: this.account.itemLoginSchemaId!,
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

  async getItemLoginSchemaForGuest(
    dbConnection: DBConnection,
    itemLoginSchemaId: string,
  ): Promise<ItemLoginSchemaWithItem | undefined> {
    const result = await dbConnection.query.itemLoginSchemasTable.findFirst({
      where: eq(itemLoginSchemasTable.id, itemLoginSchemaId),
      with: {
        item: true,
      },
    });

    return result;
  }
}
