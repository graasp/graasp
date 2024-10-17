import { EntityManager } from 'typeorm';

import { UUID } from '@graasp/sdk';

import { AbstractRepository } from '../../repositories/AbstractRepository';
import { Account } from './entities/account';

export class AccountRepository extends AbstractRepository<Account> {
  constructor(manager?: EntityManager) {
    super(Account, manager);
  }

  async get(id: typeof Account.prototype.id) {
    if (!id) {
      return undefined;
    }
    const result = await this.repository.findOneBy({ id });
    if (result === null) {
      return undefined;
    }
    return result;
  }

  async refreshLastAuthenticatedAt(id: UUID, lastAuthenticatedAt: Date) {
    await this.repository.update(id, { lastAuthenticatedAt });

    return this.get(id);
  }
}
