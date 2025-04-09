import { eq } from 'drizzle-orm/sql';

import { UUID } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { guestPasswordsTable } from '../../drizzle/schema';
import { encryptPassword } from '../auth/plugins/password/utils';

export class GuestPasswordRepository {
  async getForGuestId(db: DBConnection, guestId: string): Promise<string | undefined> {
    const res = await db.query.guestPasswordsTable.findFirst({
      where: eq(guestPasswordsTable.guestId, guestId),
    });
    return res?.password;
  }
  async patch(db: DBConnection, guestId: UUID, newPassword: string): Promise<void> {
    // auto-generate a salt and a hash
    const hash = await encryptPassword(newPassword);

    await db
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
