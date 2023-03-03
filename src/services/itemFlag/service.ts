import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../util/repositories';
import { validatePermission } from '../authorization';
import { Member } from '../member/entities/member';
import { ItemFlag } from './itemFlag';

export class ItemFlagService {
  async getAllFlags(actor: Member, repositories: Repositories) {
    const { itemFlagRepository } = repositories;
    return itemFlagRepository.getAllFlags();
  }

  async post(actor: Member, repositories: Repositories, itemId: string, body: Partial<ItemFlag>) {
    const { itemFlagRepository, itemRepository } = repositories;

    // only register member can report
    const item = await itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    return itemFlagRepository.post(body, actor, itemId);
  }
}
