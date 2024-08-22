import { EntityManager } from 'typeorm';

import { UUID, isPasswordStrong } from '@graasp/sdk';

import { AbstractRepository } from '../../../../repositories/AbstractRepository';
import { EmptyCurrentPassword, InvalidPassword, MemberNotFound } from '../../../../utils/errors';
import { MemberPassword } from './entities/password';
import { PasswordNotStrong } from './errors';
import { encryptPassword, verifyCurrentPassword } from './utils';

export class MemberPasswordRepository extends AbstractRepository<MemberPassword> {
  constructor(manager?: EntityManager) {
    super(MemberPassword, manager);
  }

  async getForMemberId(memberId: string) {
    // additional check that id is not null
    // o/w empty parameter to findOneBy return the first entry
    if (!memberId) {
      throw new MemberNotFound({ id: memberId });
    }

    const memberPassword = await this.repository.findOneBy({ member: { id: memberId } });

    return memberPassword;
  }

  async post(memberId: UUID, newEncryptedPassword: string) {
    await this.repository.insert({
      member: { id: memberId },
      password: newEncryptedPassword,
    });
  }

  async patch(memberId: UUID, newPassword: string) {
    if (!isPasswordStrong(newPassword)) {
      throw new PasswordNotStrong(newPassword);
    }

    // auto-generate a salt and a hash
    const hash = await encryptPassword(newPassword);

    const previousPassword = await this.getForMemberId(memberId);

    if (previousPassword) {
      await this.repository.update(previousPassword.id, {
        member: { id: memberId },
        password: hash,
      });
    } else {
      await this.repository.insert({
        member: { id: memberId },
        password: hash,
      });
    }
  }

  async validatePassword(memberId: UUID, currentPassword: string) {
    const memberPassword = await this.getForMemberId(memberId);
    const verified = await verifyCurrentPassword(memberPassword, currentPassword);
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
