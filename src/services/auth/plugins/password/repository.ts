import { UUID, isPasswordStrong } from '@graasp/sdk';

import { AppDataSource } from '../../../../plugins/datasource';
import { EmptyCurrentPassword, IncorrectPassword, InvalidPassword } from '../../../../utils/errors';
import { MemberPassword } from './entities/password';
import { PasswordNotStrong } from './errors';
import { encryptPassword, verifyCredentials, verifyCurrentPassword } from './utils';

export const MemberPasswordRepository = AppDataSource.getRepository(MemberPassword).extend({
  async getForMemberId(memberId: string, args: { shouldExist: boolean } = { shouldExist: true }) {
    const memberPassword = this.findOneBy({ member: { id: memberId } });

    if (!memberPassword && args.shouldExist) {
      throw new Error('password does not exist');
    }

    return memberPassword;
  },

  async patch(memberId: UUID, newPassword: string) {
    if (!isPasswordStrong(newPassword)) {
      throw new PasswordNotStrong(newPassword);
    }

    // auto-generate a salt and a hash
    const hash = await encryptPassword(newPassword);

    const previousPassword = await this.getForMemberId(memberId, { shouldExist: false });

    if (previousPassword) {
      await this.update(previousPassword.id, {
        member: { id: memberId },
        password: hash,
      });
    } else {
      await this.insert({
        member: { id: memberId },
        password: hash,
      });
    }
  },

  async validatePassword(memberId: UUID, currentPassword?: string) {
    const memberPassword = await this.getForMemberId(memberId);
    const verified = await verifyCurrentPassword(memberPassword, currentPassword);
    // throw error if password verification fails
    if (!verified) {
      if (currentPassword === '') {
        throw new EmptyCurrentPassword();
      }
      throw new InvalidPassword();
    }
  },

  async validateCredentials(
    memberPassword: MemberPassword,
    body: { email: string; password: string },
  ) {
    const verified = await verifyCredentials(memberPassword, body);
    if (!verified) {
      throw new IncorrectPassword(body);
    }
  },
});
