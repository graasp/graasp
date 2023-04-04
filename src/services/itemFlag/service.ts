import { Repositories } from '../../util/repositories';
import ItemService from '../item/service';
import { Member } from '../member/entities/member';
import { ItemFlag } from './itemFlag';

export class ItemFlagService {
  itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getAllFlags(actor: Member, repositories: Repositories) {
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
