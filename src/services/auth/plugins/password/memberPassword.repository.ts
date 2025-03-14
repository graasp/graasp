import { eq } from 'drizzle-orm/sql';
import { singleton } from 'tsyringe';

import { type UUID, isPasswordStrong } from '@graasp/sdk';

import type { DBConnection } from '../../../../drizzle/db.js';
import { type MemberPasswordRaw, memberPasswords } from '../../../../drizzle/schema.js';
import { MemberNotFound } from '../../../../utils/errors.js';
import { PasswordNotStrong } from './errors.js';
import { encryptPassword } from './utils.js';

@singleton()
export class MemberPasswordRepository {
  constructor() {}

  async getForMemberId(db: DBConnection, memberId: string): Promise<MemberPasswordRaw | undefined> {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    if (!memberId) {
      throw new MemberNotFound({ id: memberId });
    }

    const memberPassword = await db.query.memberPasswords.findFirst({
      where: eq(memberPasswords.memberId, memberId),
    });

    return memberPassword;
  }

  async post(db: DBConnection, memberId: UUID, newEncryptedPassword: string): Promise<void> {
    await db.insert(memberPasswords).values({
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
      .insert(memberPasswords)
      .values({
        memberId,
        password: hash,
      })
      .onConflictDoUpdate({
        target: memberPasswords.memberId,
        set: {
          memberId,
          password: hash,
        },
      });
  }
}
