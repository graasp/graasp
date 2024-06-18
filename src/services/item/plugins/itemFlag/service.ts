import { Repositories } from '../../../../utils/repositories.js';
import { Actor, Member } from '../../../member/entities/member.js';
import { ItemService } from '../../service.js';
import { ItemFlag } from './itemFlag.js';

export class ItemFlagService {
  itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getAllFlags(actor: Actor, repositories: Repositories) {
    const { itemFlagRepository } = repositories;
    return itemFlagRepository.getAllFlags();
  }

  async post(actor: Member, repositories: Repositories, itemId: string, body: Partial<ItemFlag>) {
    const { itemFlagRepository } = repositories;

    // only register member can report
    await this.itemService.get(actor, repositories, itemId);

    return itemFlagRepository.post(body, actor, itemId);
  }
}
