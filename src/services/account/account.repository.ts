import { eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { DBConnection } from '../../drizzle/db';
import { accounts } from '../../drizzle/schema';

@singleton()
export class AccountRepository {
  async get(db: DBConnection, id: string) {
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
