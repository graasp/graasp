import * as fs from 'fs';
import path from 'path';
import { fromPath as convertPDFtoImageFromPath } from 'pdf2pic';
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

import { asDefined } from '../../../../utils/assertions';
import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import FileService from '../../../file/service';
import { UploadEmptyFileError } from '../../../file/utils/errors';
import { Actor, Member } from '../../../member/entities/member';
import { StorageService } from '../../../member/plugins/storage/service';
import { randomHexOf4 } from '../../../utils';
import { Item } from '../../entities/Item';
import { ItemService } from '../../service';
import { readPdfContent } from '../../utils';
import { ItemThumbnailService } from '../thumbnail/service';

@singleton()
class FileItemService {
  private readonly fileService: FileService;
  private readonly itemService: ItemService;
  private readonly storageService: StorageService;
  private readonly itemThumbnailService: ItemThumbnailService;

  constructor(
    fileService: FileService,
    itemService: ItemService,
    storageService: StorageService,
    itemThumbnailService: ItemThumbnailService,
  ) {
    this.fileService = fileService;
    this.itemService = itemService;
    this.storageService = storageService;
    this.itemThumbnailService = itemThumbnailService;
  }

  public buildFilePath(extension?: string) {
    // TODO: CHANGE ??
    const filepath = `${randomHexOf4()}/${randomHexOf4()}/${randomHexOf4()}-${Date.now()}${extension}`;
    return path.join('files', filepath);
  }

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
    const filepath = this.buildFilePath(getFileExtension(filename)); // parentId, filename

    // check member storage limit
    await this.storageService.checkRemainingStorage(actor, repositories);

    return await withTmpFile(async ({ path }) => {
      // Write uploaded file to a temporary file
      await pipeline(stream, fs.createWriteStream(path));

      // Content to be indexed for search
      let content = '';
      if (MimeTypes.isPdf(mimetype)) {
        content = await readPdfContent(path);
      }

      // Upload to storage
      await this.fileService.upload(actor, {
        file: fs.createReadStream(path),
        filepath,
        mimetype,
      });

      const size = await this.fileService.getFileSize(actor, filepath);

      // throw for empty files
      if (!size) {
        await this.fileService.delete(filepath);
        throw new UploadEmptyFileError();
      }

      // create item from file properties
      const name = filename.substring(0, MAX_ITEM_NAME_LENGTH);
      const fileProperties: FileItemProperties = {
        name: filename,
        path: filepath,
        mimetype,
        size,
        content,
      };
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

      const newItem = await this.itemService.post(actor, repositories, {
        item,
        parentId,
        previousItemId,
      });

      // add thumbnails if image or pdf
      // allow failures
      try {
        if (MimeTypes.isImage(mimetype)) {
          await this.itemThumbnailService.upload(
            actor,
            repositories,
            newItem.id,
            fs.createReadStream(path),
          );
        } else if (MimeTypes.isPdf(mimetype)) {
          // Convert first page of PDF to image buffer and upload as thumbnail
          const outputImg = await convertPDFtoImageFromPath(path)(1, { responseType: 'buffer' });
          const buffer = asDefined(outputImg.buffer);
          await this.itemThumbnailService.upload(
            actor,
            repositories,
            newItem.id,
            Readable.from(buffer),
          );
        }
      } catch (e) {
        console.error(e);
      }

      // retrieve item again since hasThumbnail might have changed
      return await repositories.itemRepository.getOneOrThrow(newItem.id);
    });
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

  async copy(member: Member, repositories: Repositories, { copy }: { original; copy }) {
    const { id, extra } = copy; // full copy with new `id`
    const { path: originalPath, mimetype } = extra[this.fileService.fileType];
    // filenames are not used
    const newFilePath = this.buildFilePath();

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
}

export default FileItemService;
