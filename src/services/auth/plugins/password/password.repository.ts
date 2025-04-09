import { eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { UUID, isPasswordStrong } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { MemberPasswordRaw, memberPasswordsTable } from '../../../../drizzle/schema';
import { MemberNotFound } from '../../../../utils/errors';
import { PasswordNotStrong } from './errors';
import { encryptPassword } from './utils';

@singleton()
export class MemberPasswordRepository {
  async getForMemberId(db: DBConnection, memberId: string): Promise<MemberPasswordRaw | undefined> {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    if (!memberId) {
      throw new MemberNotFound({ id: memberId });
    }

    const memberPassword = await db.query.memberPasswordsTable.findFirst({
      where: eq(memberPasswordsTable.memberId, memberId),
    });

    return memberPassword;
  }

  async post(db: DBConnection, memberId: UUID, newEncryptedPassword: string): Promise<void> {
    await db.insert(memberPasswordsTable).values({
      memberId,
      password: newEncryptedPassword,
    });
  }

  async patch(db: DBConnection, memberId: UUID, newPassword: string): Promise<void> {
    if (!isPasswordStrong(newPassword)) {
      throw new PasswordNotStrong(newPassword);
    }

    // auto-generate a salt and a hash
    const hash = await encryptPassword(newPassword);

    await db
      .insert(memberPasswordsTable)
      .values({
        memberId,
        password: hash,
      })
      .onConflictDoUpdate({
        target: memberPasswordsTable.memberId,
        set: {
          memberId,
          password: hash,
        },
      });
  }
}
