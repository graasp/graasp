import { eq } from 'drizzle-orm/sql';

import { UUID, isPasswordStrong } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { memberPasswords } from '../../../../drizzle/schema';
import { EmptyCurrentPassword, InvalidPassword, MemberNotFound } from '../../../../utils/errors';
import { PasswordNotStrong } from './errors';
import { encryptPassword, verifyCurrentPassword } from './utils';

export class MemberPasswordRepository {
  async getForMemberId(db: DBConnection, memberId: string) {
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

  async post(db: DBConnection, memberId: UUID, newEncryptedPassword: string) {
    await db.insert(memberPasswords).values({
      memberId,
      password: newEncryptedPassword,
    });
  }

  async patch(db: DBConnection, memberId: UUID, newPassword: string) {
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

  async validatePassword(db: DBConnection, memberId: UUID, currentPassword: string) {
    const memberPassword = await this.getForMemberId(db, memberId);

    if (!memberPassword) {
      return true;
    }

    const verified = await verifyCurrentPassword(memberPassword.password, currentPassword);
    // throw error if password verification fails
    if (!verified) {
      // this should be validated by the schema, but we do it again here.
      if (currentPassword === '') {
        throw new EmptyCurrentPassword();
      }
      throw new InvalidPassword();
    }
  }
}
