import { UUID } from '@graasp/sdk';

import { Repositories } from '../../utils/repositories';
import { Actor } from '../member/entities/member';
import { FolderItem } from './entities/Item';
import { ItemServiceManager } from './itemServiceManager';
import { ItemService } from './service';

export class FolderService extends ItemService {
  async copy(actor: Actor, repositories: Repositories, itemId: UUID, args: { parentId?: UUID }) {
    const item = (await this.get(actor, repositories, itemId)) as FolderItem;

    const descendants = await repositories.itemRepository.getDescendants(item);
    const items = [...descendants, item];

    const res = await super.copy(actor, repositories, itemId, args);

    // TODO: handle children order

    // recursive given item type
    for (const i of items) {
      const service = await ItemServiceManager.getServiceForTypeFromId(repositories, i.id);
      await service.copy(actor, repositories, itemId, args);
    }

    return res;
  }

  async delete() {
    // delete self + descendants using tree, without using super
  }
}
