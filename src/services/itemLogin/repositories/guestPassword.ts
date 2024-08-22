import { EntityManager } from 'typeorm';

import { UUID } from '@graasp/sdk';

import { AbstractRepository } from '../../../repositories/AbstractRepository';
import { encryptPassword } from '../../auth/plugins/password/utils';
import { GuestPassword } from '../entities/guestPassword';

export class GuestPasswordRepository extends AbstractRepository<GuestPassword> {
  constructor(manager?: EntityManager) {
    super(GuestPassword, manager);
  }

  async getForGuestId(guestId: string) {
    const memberPassword = await this.repository.findOneBy({ guest: { id: guestId } });
    return memberPassword;
  }
  async patch(guestId: UUID, newPassword: string) {
    // auto-generate a salt and a hash
    const hash = await encryptPassword(newPassword);

    const previousPassword = await this.getForGuestId(guestId);

    if (previousPassword) {
      await this.repository.update(previousPassword.id, {
        guest: { id: guestId },
        password: hash,
      });
    } else {
      await this.repository.insert({
        guest: { id: guestId },
        password: hash,
      });
    }
  }
}
