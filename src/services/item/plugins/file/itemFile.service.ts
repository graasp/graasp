import * as fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { withFile as withTmpFile } from 'tmp-promise';
import { delay, inject, singleton } from 'tsyringe';

import {
  type FileItemProperties,
  MAX_ITEM_NAME_LENGTH,
  MimeTypes,
  getFileExtension,
} from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { type ItemRaw } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import type { MaybeUser, MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import FileService from '../../../file/file.service';
import { UploadEmptyFileError } from '../../../file/utils/errors';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { StorageService } from '../../../member/plugins/storage/memberStorage.service';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { randomHexOf4 } from '../../../utils';
import { ItemWrapperService } from '../../ItemWrapper';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { readPdfContent } from '../../utils';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { RecycledBinService } from '../recycled/recycled.service';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';

@singleton()
class FileItemService extends ItemService {
  private readonly fileService: FileService;
  private readonly storageService: StorageService;

  constructor(
    thumbnailService: ThumbnailService,
    fileService: FileService,
    storageService: StorageService,
    meilisearchWrapper: MeiliSearchWrapper,
    @inject(delay(() => ItemThumbnailService))
    itemThumbnailService: ItemThumbnailService,
    authorizedItemService: AuthorizedItemService,
    itemRepository: ItemRepository,
    itemMembershipRepository: ItemMembershipRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemGeolocationRepository: ItemGeolocationRepository,
    itemWrapperService: ItemWrapperService,
    itemVisibilityRepository: ItemVisibilityRepository,
    recycledBinService: RecycledBinService,
    log: BaseLogger,
  ) {
    super(
      thumbnailService,
      itemThumbnailService,
      itemMembershipRepository,
      meilisearchWrapper,
      itemRepository,
      itemPublishedRepository,
      itemGeolocationRepository,
      authorizedItemService,
      itemWrapperService,
      itemVisibilityRepository,
      recycledBinService,
      log,
    );
    this.fileService = fileService;
    this.storageService = storageService;
  }

  private buildFilePath(extension: string = '') {
    // TODO: CHANGE ??
    const filepath = `${randomHexOf4()}/${randomHexOf4()}/${randomHexOf4()}-${Date.now()}${extension}`;
    return path.join('files', filepath);
  }

  /**
   * Upload the file and create an item from the extracted file properties.
   * @returns The newly created item
   */
  async uploadFileAndCreateItem(
    dbConnection: DBConnection,
    actor: MinimalMember,
    {
      description,
      parentId,
      filename,
      mimetype,
      stream,
      previousItemId,
    }: {
      description?: string;
      parentId?: string;
      filename: string;
      mimetype: string;
      stream: Readable;
      previousItemId?: ItemRaw['id'];
    },
  ) {
    // Create temporary file
    return await withTmpFile(async ({ path: tmpPath }) => {
      // Write the uploaded file to the temporary file
      await pipeline(stream, fs.createWriteStream(tmpPath));

      // Upload the file
      const fileProperties = await this.uploadFile(dbConnection, actor, {
        filename,
        filepath: tmpPath,
        mimetype,
      });

      // Add thumbnails if the file is an image or a pdf
      const thumbnail = await this.itemThumbnailService.generateThumbnail(tmpPath, mimetype);

      // Create item from file properties
      return await this.createItemFromFileProperties(dbConnection, actor, {
        description,
        parentId,
        filename,
        fileProperties,
        previousItemId,
        thumbnail,
      });
    });
  }

  /**
   * Upload a file to the database and return the file item properties.
   * @returns The file item properties extracted from the provided file
   */
  async uploadFile(
    dbConnection: DBConnection,
    actor: MinimalMember,
    {
      filename,
      filepath,
      mimetype,
    }: {
      filename: string;
      filepath: string;
      mimetype: string;
    },
  ) {
    // Check member storage limit
    await this.storageService.checkRemainingStorage(dbConnection, actor);

    // Build the storage file path
    const storageFilepath = this.buildFilePath(getFileExtension(filename));

    // Upload to storage
    await this.fileService.upload(actor, {
      file: fs.createReadStream(filepath),
      filepath: storageFilepath,
      mimetype,
    });

    // Check the file size
    const size = await this.fileService.getFileSize(actor, storageFilepath);
    if (!size) {
      await this.fileService.delete(storageFilepath);
      throw new UploadEmptyFileError();
    }

    // Content to be indexed for search
    let content = '';
    if (MimeTypes.isPdf(mimetype)) {
      content = await readPdfContent(filepath);
    }

    // Return the file item properties
    return {
      name: filename,
      path: storageFilepath,
      mimetype,
      size,
      content,
    } as FileItemProperties;
  }

  async getFile(
    dbConnection: DBConnection,
    maybeUser: MaybeUser,
    {
      itemId,
    }: {
      itemId: string;
    },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });
    const extraData = item.extra['file'] as FileItemProperties;
    const result = await this.fileService.getFile({
      id: itemId,
      ...extraData,
    });

    return result;
  }

  async getUrl(
    dbConnection: DBConnection,
    maybeUser: MaybeUser,
    {
      itemId,
    }: {
      itemId: string;
    },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await this.authorizedItemService.getItemById(dbConnection, {
      accountId: maybeUser?.id,
      itemId,
    });
    const extraData = item.extra['file'] as FileItemProperties | undefined;

    const result = await this.fileService.getUrl({
      path: extraData?.path,
    });

    return result;
  }

  async copyFile(dbConnection: DBConnection, member: MinimalMember, { copy }: { original; copy }) {
    const { id, extra } = copy; // full copy with new `id`
    const { path: originalPath, mimetype, name } = extra['file'];
    const newFilePath = this.buildFilePath(getFileExtension(name));

    const data = {
      newId: id,
      originalPath,
      newFilePath,
      mimetype,
    };

    // check member storage limit in pre copy because all items are pretested

    const filepath = await this.fileService.copy(member, data);

    // update item copy's 'extra'
    await this.itemRepository.updateOne(dbConnection, copy.id, {
      extra: { file: { ...extra['file'], path: filepath } },
    });
  }

  async update(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: ItemRaw['id'],
    body: Partial<Pick<ItemRaw, 'name' | 'description' | 'settings' | 'lang'>>,
  ) {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is file
    if ('file' !== item.type) {
      throw new WrongItemTypeError(item.type);
    }

    await super.patch(dbConnection, member, item.id, body);
  }

  /**
   * Form and post a new item with properties derived from the file.
   */
  private async createItemFromFileProperties(
    dbConnection: DBConnection,
    actor: MinimalMember,
    {
      description,
      parentId,
      filename,
      fileProperties,
      previousItemId,
      thumbnail,
    }: {
      description?: string;
      parentId?: string;
      filename: string;
      fileProperties: FileItemProperties;
      previousItemId?: ItemRaw['id'];
      thumbnail?: Readable;
    },
  ) {
    const name = filename.substring(0, MAX_ITEM_NAME_LENGTH);

    const item = {
      name,
      description,
      type: 'file' as const,
      extra: {
        ['file']: fileProperties,
      },
      creator: actor,
    };

    return super.post(dbConnection, actor, {
      item,
      parentId,
      previousItemId,
      thumbnail,
    });
  }
}

export default FileItemService;
