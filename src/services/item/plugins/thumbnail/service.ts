import { SavedMultipartFile } from '@fastify/multipart';

import { PermissionLevel } from '@graasp/sdk';

import { Repositories } from '../../../../util/repositories';
import { validatePermission } from '../../../authorization';
import { FastifyReply } from 'fastify';
import FileService from '../../../file/service';
import ItemService from '../../service';
import { ThumbnailService } from '../../../thumbnail/service';

export class FileThumbnailService {
  thumbnailService: ThumbnailService;
  shouldRedirectOnDownload: boolean;
  itemService:ItemService;

  constructor( itemService: ItemService, fileService:FileService, shouldRedirectOnDownload) {
    this.shouldRedirectOnDownload = shouldRedirectOnDownload;
    this.thumbnailService = new ThumbnailService(fileService, true, 'thumbnails');
    this.itemService=itemService;
  }

  async upload(actor, repositories: Repositories, itemId: string, file: SavedMultipartFile) {
    const item = await repositories.itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Write, actor, item);
 
    await this.thumbnailService.upload(actor,  itemId, file);

    // update item that should have thumbnail
    await this.itemService.patch(actor, repositories, itemId, {
      settings: { hasThumbnail: true  },
    });

    return item;
  }

  async download(actor, repositories: Repositories, { reply, size, itemId, replyUrl }:  { reply:FastifyReply, size:string, itemId:string, replyUrl:boolean }) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await repositories.itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);
    
    const result = await this.thumbnailService.download(actor, {
      reply: this.shouldRedirectOnDownload ? reply : null,
      replyUrl,
      size,
      id:itemId,
    });

    return result;
  }
}
