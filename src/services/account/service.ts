import { singleton } from 'tsyringe';

import { UUID } from '@graasp/sdk';

import { BaseLogger } from '../../logger';
import HookManager from '../../utils/hook';
import { Repositories } from '../../utils/repositories';

@singleton()
export class AccountService {
  hooks = new HookManager();
  private readonly log: BaseLogger;

  constructor(log: BaseLogger) {
    this.log = log;
  }

  async refreshLastAuthenticatedAt(id: UUID, { accountRepository }: Repositories) {
    return await accountRepository.refreshLastAuthenticatedAt(id, new Date());
  }
}
