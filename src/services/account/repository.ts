import { eq } from 'drizzle-orm/sql';
import { EntityManager } from 'typeorm';

import { db } from '../../drizzle/db';
import { accounts } from '../../drizzle/schema';
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
    const result = await db.query.accounts.findFirst({
      where: eq(accounts.id, id),
    });
    if (result === null) {
      return undefined;
    }
    return result;
  }
}
