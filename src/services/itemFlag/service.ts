import { UnauthorizedMember } from '../../util/graasp-error';
import { Repositories } from '../../util/repositories';
import ItemService from '../item/service';
import { Actor } from '../member/entities/member';
import { ItemFlag } from './itemFlag';

export class ItemFlagService {
  itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getAllFlags(actor: Actor, repositories: Repositories) {
    const { itemFlagRepository } = repositories;
    return itemFlagRepository.getAllFlags();
  }

  async post(actor: Actor, repositories: Repositories, itemId: string, body: Partial<ItemFlag>) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }
    const { itemFlagRepository } = repositories;

    // only register member can report
    await this.itemService.get(actor, repositories, itemId);

    return itemFlagRepository.post(body, actor, itemId);
  }
}
