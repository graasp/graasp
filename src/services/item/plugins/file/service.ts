import * as fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { withFile as withTmpFile } from 'tmp-promise';
import { singleton } from 'tsyringe';

import {
  FileItemProperties,
  ItemType,
  MAX_ITEM_NAME_LENGTH,
  MimeTypes,
  PermissionLevel,
  getFileExtension,
} from '@graasp/sdk';

import { BaseLogger } from '../../../../logger';
import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import FileService from '../../../file/service';
import { UploadEmptyFileError } from '../../../file/utils/errors';
import { Actor, Member } from '../../../member/entities/member';
import { StorageService } from '../../../member/plugins/storage/service';
import { ThumbnailService } from '../../../thumbnail/service';
import { randomHexOf4 } from '../../../utils';
import { Item } from '../../entities/Item';
import { WrongItemTypeError } from '../../errors';
import { ItemService } from '../../service';
import { readPdfContent } from '../../utils';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { ItemThumbnailService } from '../thumbnail/service';

@singleton()
class FileItemService extends ItemService {
  private readonly fileService: FileService;
  private readonly storageService: StorageService;

  constructor(
    thumbnailService: ThumbnailService,
    fileService: FileService,
    storageService: StorageService,
    meilisearchWrapper: MeiliSearchWrapper,
    itemThumbnailService: ItemThumbnailService,
    log: BaseLogger,
  ) {
    super(thumbnailService, itemThumbnailService, meilisearchWrapper, log);
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
  async upload(
    actor: Member,
    repositories: Repositories,
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
      previousItemId?: Item['id'];
    },
  ) {
    // Create temporary file
    return await withTmpFile(async ({ path: tmpPath }) => {
      // Write the uploaded file to the temporary file
      await pipeline(stream, fs.createWriteStream(tmpPath));

      // Upload the file
      const fileProperties = await this.uploadFile(actor, repositories, {
        filename,
        filepath: tmpPath,
        mimetype,
      });

      // Add thumbnails if the file is an image or a pdf
      const thumbnail = await this.itemThumbnailService.generateThumbnail(tmpPath, mimetype);

      // Create item from file properties
      return await this.createItemFromFileProperties(actor, repositories, {
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
    actor: Member,
    repositories: Repositories,
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
    await this.storageService.checkRemainingStorage(actor, repositories);

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
    actor: Actor,
    repositories: Repositories,
    {
      itemId,
    }: {
      itemId: string;
    },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await repositories.itemRepository.getOneOrThrow(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);
    const extraData = item.extra[this.fileService.fileType] as FileItemProperties;
    const result = await this.fileService.getFile(actor, {
      id: itemId,
      ...extraData,
    });

    return result;
  }

  async getUrl(
    actor: Actor,
    repositories: Repositories,
    {
      itemId,
    }: {
      itemId: string;
    },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await repositories.itemRepository.getOneOrThrow(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);
    const extraData = item.extra[this.fileService.fileType] as FileItemProperties | undefined;

    const result = await this.fileService.getUrl({
      path: extraData?.path,
    });

    return result;
  }

  async copyFile(member: Member, repositories: Repositories, { copy }: { original; copy }) {
    const { id, extra } = copy; // full copy with new `id`
    const { path: originalPath, mimetype, name } = extra[this.fileService.fileType];
    const newFilePath = this.buildFilePath(getFileExtension(name));

    const data = {
      newId: id,
      originalPath,
      newFilePath,
      mimetype,
    };

    // check member storage limit in pre copy because all items are pretested

    // DON'T use task runner for copy file task: this would generate a new transaction
    // which is useless since the file copy task should not touch the DB at all
    // TODO: replace when the file plugin has been refactored into a proper file service
    const filepath = await this.fileService.copy(member, data);

    // update item copy's 'extra'
    if (this.fileService.fileType === ItemType.S3_FILE) {
      await repositories.itemRepository.updateOne(copy.id, {
        extra: { s3File: { ...extra.s3File, path: filepath } },
      });
    } else {
      await repositories.itemRepository.updateOne(copy.id, {
        extra: { file: { ...extra.s3File, path: filepath } },
      });
    }
  }

  async update(
    member: Member,
    repositories: Repositories,
    itemId: Item['id'],
    body: Partial<Pick<Item, 'name' | 'description' | 'settings' | 'lang'>>,
  ) {
    const { itemRepository } = repositories;
    const item = await itemRepository.getOneOrThrow(itemId);

    // check item is file
    if (!([ItemType.LOCAL_FILE, ItemType.S3_FILE] as Item['type'][]).includes(item.type)) {
      throw new WrongItemTypeError(item.type);
    }

    await super.patch(member, repositories, item.id, body);
  }

  /**
   * Form and post a new item with properties derived from the file.
   */
  private async createItemFromFileProperties(
    actor: Member,
    repositories: Repositories,
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
      previousItemId?: Item['id'];
      thumbnail?: Readable;
    },
  ) {
    const name = filename.substring(0, MAX_ITEM_NAME_LENGTH);

    const item = {
      name,
      description,
      type: this.fileService.fileType,
      extra: {
        // this is needed because if we directly use `this.fileService.type` then TS widens the type to `string` which we do not want
        ...(this.fileService.fileType === ItemType.LOCAL_FILE
          ? { [ItemType.LOCAL_FILE]: fileProperties }
          : { [ItemType.S3_FILE]: fileProperties }),
      },
      creator: actor,
    };

    return super.post(actor, repositories, {
      item,
      parentId,
      previousItemId,
      thumbnail,
    });
  }
}

export default FileItemService;
