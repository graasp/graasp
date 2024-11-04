import { singleton } from 'tsyringe';

import { PermissionLevel, UUID } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Actor } from '../../../member/entities/member';
import { ItemService } from '../../service';

@singleton()
export class ItemTagService {
  private readonly itemService: ItemService;

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getForItem(actor: Actor, repositories: Repositories, itemId: UUID) {
    const { itemTagRepository } = repositories;

    // Get item and check permission
    await this.itemService.get(actor, repositories, itemId, PermissionLevel.Read);

    return await itemTagRepository.getForItem(itemId);
  }
}
