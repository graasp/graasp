import { eq } from 'drizzle-orm/sql';

import { UUID } from '@graasp/sdk';

import { DBConnection } from '../../drizzle/db';
import { guestPasswords } from '../../drizzle/schema';
import { encryptPassword } from '../auth/plugins/password/utils';

export class GuestPasswordRepository {
  async getForGuestId(db: DBConnection, guestId: string): Promise<string | undefined> {
    const res = await db.query.guestPasswords.findFirst({
      where: eq(guestPasswords.guestId, guestId),
    });
    return res?.password;
  }
  async patch(db: DBConnection, guestId: UUID, newPassword: string): Promise<void> {
    // auto-generate a salt and a hash
    const hash = await encryptPassword(newPassword);

    await db
      .insert(guestPasswords)
      .values({
        guestId,
        password: hash,
      })
      .onConflictDoUpdate({
        target: guestPasswords.guestId,
        set: {
          guestId,
          password: hash,
        },
      });
  }
}
