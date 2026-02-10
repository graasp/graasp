import * as fs from 'fs';
import { fromPath as convertPDFtoImageFromPath } from 'pdf2pic';
import { Readable } from 'stream';
import { delay, inject, injectable } from 'tsyringe';

import { MimeTypes, ThumbnailSize } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { BaseLogger } from '../../../../logger';
import type { MaybeUser, MinimalMember } from '../../../../types';
import { asDefined } from '../../../../utils/assertions';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { type ItemRaw } from '../../item';
import { ItemService } from '../../item.service';
import { DEFAULT_ITEM_THUMBNAIL_SIZES } from './constants';
import type { ItemsThumbnails } from './types';

@injectable()
export class ItemThumbnailService {
  private readonly thumbnailService: ThumbnailService;
  private readonly itemService: ItemService;
  private readonly logger: BaseLogger;
  private readonly authorizedItemService: AuthorizedItemService;

  constructor(
    // As ItemService use ItemThumbnailService, there is a circular dependency issue.
    // This can be solved by refactoring the code or using the `delay` helper function.
    @inject(delay(() => ItemService)) itemService: ItemService,
    thumbnailService: ThumbnailService,
    @inject(delay(() => AuthorizedItemService))
    authorizedItemService: AuthorizedItemService,
    logger: BaseLogger,
  ) {
    this.thumbnailService = thumbnailService;
    this.itemService = itemService;
    this.authorizedItemService = authorizedItemService;
    this.logger = logger;
  }

  async upload(dbConnection: DBConnection, member: MinimalMember, itemId: string, file: Readable) {
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      permission: 'write',
      accountId: member.id,
      itemId,
    });
    await this.thumbnailService.upload(member, itemId, file);

    // update item that should have thumbnail
    await this.itemService.patch(dbConnection, member, itemId, {
      settings: { hasThumbnail: true },
    });
  }

  async getFile(
    dbConnection: DBConnection,
    maybeUser: MaybeUser,
    { size, itemId }: { size: string; itemId: string },
  ) {
    // prehook: get item and input in download call ?
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });

    const result = await this.thumbnailService.getFile({
      id: itemId,
      size,
    });

    return result;
  }

  async getUrl(
    dbConnection: DBConnection,
    maybeUser: MaybeUser,
    { size, itemId }: { size: string; itemId: string },
  ) {
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });

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
  ): Promise<ItemsThumbnails> {
    if (!items?.length) {
      return {};
    }

    // Create a flat array of [{itemId, size}] tuple
    const itemsIdWithThumbnail = items
      .filter((i) => Boolean(i.settings.hasThumbnail))
      .map((i) => DEFAULT_ITEM_THUMBNAIL_SIZES.map((size) => ({ id: i.id, size })))
      .flat();

    // fetch all thumbnails
    const thumbnails = await Promise.allSettled(
      itemsIdWithThumbnail.map(
        async ({ id, size }) =>
          await this.thumbnailService.getUrl({
            size: String(size),
            id,
          }),
      ),
    );

    // Map results back to { [itemId]: { [size]: url } }
    const itemsThumbnails: ItemsThumbnails = {};

    thumbnails.forEach((result, idx) => {
      const { id, size } = itemsIdWithThumbnail[idx];
      if (result.status === 'fulfilled') {
        if (!itemsThumbnails[id]) {
          itemsThumbnails[id] = { small: '', medium: '' };
        }
        itemsThumbnails[id][size] = result.value;
      } else {
        // log error
        console.error(`Failed to get thumbnail for ID ${id} and size ${size}:`, result.reason);
      }
    });

    // filter itemThumbnails that are not complete
    const filteredItemsThumbnails = Object.fromEntries(
      Object.entries(itemsThumbnails).filter((itemT) =>
        DEFAULT_ITEM_THUMBNAIL_SIZES.every((size) => itemT[size] !== ''),
      ),
    );

    return filteredItemsThumbnails;
  }

  async deleteAllThumbnailSizes(
    dbConnection: DBConnection,
    member: MinimalMember,
    { itemId }: { itemId: string },
  ) {
    await this.authorizedItemService.assertAccessForItemId(dbConnection, {
      accountId: member.id,
      itemId,
      permission: 'write',
    });
    await Promise.all(
      Object.values(ThumbnailSize).map(async (size) => {
        this.thumbnailService.delete({ id: itemId, size });
      }),
    );
    await this.itemService.patch(dbConnection, member, itemId, {
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
