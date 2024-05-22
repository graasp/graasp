import { Readable } from 'stream';

import { PermissionLevel, ThumbnailSize } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import { Actor, Member } from '../../../member/entities/member';
import { ThumbnailService } from '../../../thumbnail/service';
import ItemService from '../../service';

export class ItemThumbnailService {
  thumbnailService: ThumbnailService;
  itemService: ItemService;

  constructor(itemService: ItemService, thumbnailService: ThumbnailService) {
    this.thumbnailService = thumbnailService;
    this.itemService = itemService;
  }

  async upload(actor: Member, repositories: Repositories, itemId: string, file: Readable) {
    const item = await repositories.itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Write, actor, item);
    await this.thumbnailService.upload(actor, itemId, file);

    // update item that should have thumbnail
    await this.itemService.patch(actor, repositories, itemId, {
      settings: { hasThumbnail: true },
    });
    return item;
  }

  async getFile(
    actor: Actor,
    repositories: Repositories,
    { size, itemId }: { size: string; itemId: string },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await repositories.itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    const result = await this.thumbnailService.getFile(actor, {
      size,
      id: itemId,
    });

    return result;
  }
  async getUrl(
    actor: Actor,
    repositories: Repositories,
    { size, itemId }: { size: string; itemId: string },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await repositories.itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    const result = await this.thumbnailService.getUrl(actor, {
      size,
      id: itemId,
    });

    return result;
  }

  async deleteAllThumbnailSizes(
    actor: Member,
    repositories: Repositories,
    { itemId }: { itemId: string },
  ) {
    await this.itemService.get(actor, repositories, itemId, PermissionLevel.Write);
    await Promise.all(
      Object.values(ThumbnailSize).map(async (size) => {
        // we take care of these promises in the Promise.all()
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.thumbnailService.delete(actor, { id: itemId, size });
      }),
    );
    await this.itemService.patch(actor, repositories, itemId, {
      settings: { hasThumbnail: false },
    });
  }
}
