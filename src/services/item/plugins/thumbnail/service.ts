import { Readable } from 'stream';

import { FastifyReply } from 'fastify';

import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import FileService from '../../../file/service';
import { Actor, Member } from '../../../member/entities/member';
import { ThumbnailService } from '../../../thumbnail/service';
import ItemService from '../../service';

export class ItemThumbnailService {
  thumbnailService: ThumbnailService;
  itemService: ItemService;

  constructor(itemService: ItemService, fileService: FileService) {
    this.thumbnailService = new ThumbnailService(fileService, true, 'thumbnails');
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

  async download(
    actor: Actor,
    repositories: Repositories,
    {
      reply,
      size,
      itemId,
      replyUrl,
    }: { reply: FastifyReply; size: string; itemId: string; replyUrl?: boolean },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await repositories.itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    const result = await this.thumbnailService.download(actor, {
      reply,
      replyUrl,
      size,
      id: itemId,
    });

    return result;
  }
}
