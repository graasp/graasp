import { singleton } from 'tsyringe';

import { PermissionLevel } from '@graasp/sdk';

import HookManager from '../../../../../utils/hook';
import { Repositories } from '../../../../../utils/repositories';
import { Actor, Member } from '../../../../member/entities/member';
import { ItemService } from '../../../service';
import { ItemCategory } from '../entities/ItemCategory';

@singleton()
export class ItemCategoryService {
  private itemService: ItemService;

  hooks = new HookManager<{
    create: { pre: { item: string; category: string }; post: { itemCategory: ItemCategory } };
    delete: { pre: { itemCategory: ItemCategory }; post: { itemCategory: ItemCategory } };
  }>();

  constructor(itemService: ItemService) {
    this.itemService = itemService;
  }

  async getForItem(actor: Actor, repositories: Repositories, itemId: string) {
    const { itemCategoryRepository } = repositories;
    // get and check permissions
    await this.itemService.get(actor, repositories, itemId);

    return itemCategoryRepository.getForItem(itemId);
  }

  async post(member: Member, repositories: Repositories, itemId: string, categoryId: string) {
    const { itemCategoryRepository } = repositories;

    // get and check permissions
    const item = await this.itemService.get(member, repositories, itemId, PermissionLevel.Admin);

    await this.hooks.runPreHooks('create', member, repositories, {
      item: itemId,
      category: categoryId,
    });

    const result = await itemCategoryRepository.addOne({
      itemPath: item.path,
      categoryId: categoryId,
    });

    await this.hooks.runPostHooks('create', member, repositories, { itemCategory: result });

    return result;
  }

  async delete(member: Member, repositories: Repositories, itemId: string, itemCategoryId: string) {
    const { itemCategoryRepository } = repositories;

    // get and check permissions
    await this.itemService.get(member, repositories, itemId, PermissionLevel.Admin);

    const itemCategory = await itemCategoryRepository.getOneOrThrow(itemCategoryId);

    await this.hooks.runPreHooks('delete', member, repositories, { itemCategory });

    const result = await itemCategoryRepository.deleteOne(itemCategoryId);

    await this.hooks.runPostHooks('delete', member, repositories, { itemCategory });

    return result;
  }
}
