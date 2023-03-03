import { AppDataSource } from '../../../../plugins/datasource';
import {
  EmptyCurrentPassword,
  IncorrectPassword,
  InvalidPassword,
} from '../../../../util/graasp-error';
import { MemberPassword } from './entities/password';
import { encryptPassword, verifyCredentials, verifyCurrentPassword } from './utils';

export const MemberPasswordRepository = AppDataSource.getRepository(MemberPassword).extend({
  async getForMemberId(memberId: string) {
    const memberPassword = this.findOneBy({ member: { id: memberId } });

    // await this.createQueryBuilder('password')
    //   .leftJoinAndSelect('password.member', 'member')
    //   .where('member.id = :id', { id: memberId })
    //   .getOne();

    if (!memberPassword) {
      throw new Error('password does not exist');
    }

    return memberPassword;
  },

  async patch(memberId: string, newPassword: string) {
    // auto-generate a salt and a hash
    const hash = await encryptPassword(newPassword);
    await this.update(memberId, {
      password: hash,
    });
  },

  async validatePassword(memberId, currentPassword) {
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

  async validateCredentials(memberPassword, body) {
    const verified = await verifyCredentials(memberPassword, body, this.log);
    if (!verified) {
      throw new IncorrectPassword(body);
    }
  },
});
