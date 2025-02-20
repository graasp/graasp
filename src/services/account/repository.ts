import { eq } from 'drizzle-orm/sql';
import { EntityManager } from 'typeorm';

import { db } from '../../drizzle/db';
import { account } from '../../drizzle/schema';
import { AbstractRepository } from '../../repositories/AbstractRepository';
import { Account } from './entities/account';

export class AccountRepository extends AbstractRepository<Account> {
  constructor(manager?: EntityManager) {
    super(Account, manager);
  }

  async get(id: string) {
    if (!id) {
      return undefined;
    }
    const result = await db.query.account.findFirst({
      where: eq(account.id, id),
    });
    if (result === null) {
      return undefined;
    }
    return result;
  }
}
