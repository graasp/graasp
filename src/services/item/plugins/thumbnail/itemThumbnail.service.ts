import * as fs from 'fs';
import { fromPath as convertPDFtoImageFromPath } from 'pdf2pic';
import { Readable } from 'stream';
import { delay, inject, injectable } from 'tsyringe';

import { MimeTypes, PermissionLevel, ThumbnailSize } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { type ItemRaw } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import { MaybeUser, MinimalMember } from '../../../../types';
import { asDefined } from '../../../../utils/assertions';
import { AuthorizationService } from '../../../authorization';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { BasicItemService } from '../../basic.service';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { DEFAULT_ITEM_THUMBNAIL_SIZES } from './constants';
import { ItemThumbnailSize, ItemsThumbnails } from './types';

@injectable()
export class ItemThumbnailService {
  private readonly thumbnailService: ThumbnailService;
  private readonly basicItemService: BasicItemService;
  private readonly itemService: ItemService;
  private readonly logger: BaseLogger;
  private readonly authorizationService: AuthorizationService;
  private readonly itemRepository: ItemRepository;

  constructor(
    // As ItemService use ItemThumbnailService, there is a circular dependency issue.
    // This can be solved by refactoring the code or using the `delay` helper function.
    @inject(delay(() => ItemService)) itemService: ItemService,
    thumbnailService: ThumbnailService,
    basicItemService: BasicItemService,
    @inject(delay(() => AuthorizationService))
    authorizationService: AuthorizationService,
    itemRepository: ItemRepository,
    logger: BaseLogger,
  ) {
    this.thumbnailService = thumbnailService;
    this.basicItemService = basicItemService;
    this.itemService = itemService;
    this.itemRepository = itemRepository;
    this.authorizationService = authorizationService;
    this.logger = logger;
  }

  async upload(dbConnection: DBConnection, actor: MinimalMember, itemId: string, file: Readable) {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);
    await this.authorizationService.validatePermission(
      dbConnection,
      PermissionLevel.Write,
      actor,
      item,
    );
    await this.thumbnailService.upload(actor, itemId, file);

    // update item that should have thumbnail
    await this.itemService.patch(dbConnection, actor, itemId, {
      settings: { hasThumbnail: true },
    });
    return item;
  }

  async getFile(
    dbConnection: DBConnection,
    actor: MaybeUser,
    { size, itemId }: { size: string; itemId: string },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);
    await this.authorizationService.validatePermission(
      dbConnection,
      PermissionLevel.Read,
      actor,
      item,
    );

    const result = await this.thumbnailService.getFile(actor, {
      size,
      id: itemId,
    });

    return result;
  }

  async getUrl(
    dbConnection: DBConnection,
    actor: MaybeUser,
    { size, itemId }: { size: string; itemId: string },
  ) {
    const item = await this.basicItemService.get(dbConnection, actor, itemId);

    // item does not have thumbnail
    if (!item.settings.hasThumbnail) {
      return null;
    }

    const result = await this.thumbnailService.getUrl({
      size,
      id: itemId,
    });

    return result;
  }

  /**
   * Retrieves thumbnail URLs for the given item ID.
   *
   * **PLEASE NOTE** : Permissions on items must be validated before calling this method!
   *
   * @param items The items for which thumbnails are to be retrieved. Only thumbnails of items with `hasThumbnail` setting will be retrieved.
   * @returns An object whose keys are the item id and whose values are the URLs stored by size.
   * */
  async getUrlsByItems(
    items: (Pick<ItemRaw, 'id'> & {
      settings: Pick<ItemRaw['settings'], 'hasThumbnail'>;
    })[],
    sizes: ItemThumbnailSize[] = DEFAULT_ITEM_THUMBNAIL_SIZES,
  ) {
    if (!items?.length || !sizes.length) {
      return {};
    }

    const itemsIdWithThumbnail = items
      .filter((i) => Boolean(i.settings.hasThumbnail))
      .map((i) => i.id);
    const thumbnailSizes = Array.from(new Set(sizes)); // Ensures that sizes are unique.

    const thumbnailsPerItem = await Promise.allSettled<ItemsThumbnails>(
      itemsIdWithThumbnail.map(async (id) => {
        const thumbnails = await Promise.all(
          thumbnailSizes.map(async (size) => {
            const url = await this.thumbnailService.getUrl({
              size: String(size),
              id,
            });
            return [size, url];
          }),
        );
        return { [id]: Object.fromEntries(thumbnails) };
      }),
    );

    // As thumbnailsPerItem is an array, convert the array into an object where each key is the itemId.
    return thumbnailsPerItem.reduce<ItemsThumbnails>((acc, res) => {
      if (res.status === 'fulfilled') {
        return { ...acc, ...res.value };
      }

      this.logger.error(
        `An error occured while fetching the item's thumbnails. The reason: ${res.reason}`,
      );
      return acc;
    }, {});
  }

  async deleteAllThumbnailSizes(
    dbConnection: DBConnection,
    actor: MinimalMember,
    { itemId }: { itemId: string },
  ) {
    await this.basicItemService.get(dbConnection, actor, itemId, PermissionLevel.Write);
    await Promise.all(
      Object.values(ThumbnailSize).map(async (size) => {
        this.thumbnailService.delete({ id: itemId, size });
      }),
    );
    await this.itemService.patch(dbConnection, actor, itemId, {
      settings: { hasThumbnail: false },
    });
  }

  /**
   * Generate a thumbnail from the file, if possible.
   * @param path File path
   * @param mimetype Mimetype of the file
   * @returns
   */
  async generateThumbnail(path: string, mimetype: string) {
    try {
      if (MimeTypes.isImage(mimetype)) {
        return fs.createReadStream(path);
      } else if (MimeTypes.isPdf(mimetype)) {
        // Convert first page of PDF to image buffer and upload as thumbnail
        const outputImg = await convertPDFtoImageFromPath(path)(1, { responseType: 'buffer' });
        const buffer = asDefined(outputImg.buffer);
        return Readable.from(buffer);
      }
    } catch (e) {
      console.error(e);
    }
  }
}
