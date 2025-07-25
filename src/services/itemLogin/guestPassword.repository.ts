import { eq } from 'drizzle-orm/sql';

import type { UUID } from '@graasp/sdk';

import type { DBConnection } from '../../drizzle/db';
import { guestPasswordsTable } from '../../drizzle/schema';
import { encryptPassword } from '../auth/plugins/password/utils';

export class GuestPasswordRepository {
  async getForGuestId(dbConnection: DBConnection, guestId: string): Promise<string | undefined> {
    const res = await dbConnection.query.guestPasswordsTable.findFirst({
      where: eq(guestPasswordsTable.guestId, guestId),
    });
    return res?.password;
  }
  async put(dbConnection: DBConnection, guestId: UUID, newPassword: string): Promise<void> {
    // auto-generate a salt and a hash
    const hash = await encryptPassword(newPassword);

    await dbConnection
      .insert(guestPasswordsTable)
      .values({
        guestId,
        password: hash,
      })
      .onConflictDoUpdate({
        target: guestPasswordsTable.guestId,
        set: {
          guestId,
          password: hash,
        },
      });
  }
}
