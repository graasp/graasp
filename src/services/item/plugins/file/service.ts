import * as fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { withFile as withTmpFile } from 'tmp-promise';

import {
  FileItemProperties,
  ItemType,
  MAX_ITEM_NAME_LENGTH,
  MimeTypes,
  PermissionLevel,
  getFileExtension,
} from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import FileService from '../../../file/service';
import { UploadEmptyFileError } from '../../../file/utils/errors';
import { Actor, Member } from '../../../member/entities/member';
import { StorageService } from '../../../member/plugins/storage/service';
import { randomHexOf4 } from '../../../utils';
import { ItemService } from '../../service';
import { readPdfContent } from '../../utils';
import { ItemThumbnailService } from '../thumbnail/service';

class FileItemService {
  fileService: FileService;
  itemService: ItemService;
  storageService: StorageService;
  itemThumbnailService: ItemThumbnailService;
  shouldRedirectOnDownload: boolean;

  buildFilePath(extension?: string) {
    // TODO: CHANGE ??
    const filepath = `${randomHexOf4()}/${randomHexOf4()}/${randomHexOf4()}-${Date.now()}${extension}`;
    return path.join('files', filepath);
  }

  constructor(
    fileService: FileService,
    itemService: ItemService,
    storageService: StorageService,
    itemThumbnailService: ItemThumbnailService,
    shouldRedirectOnDownload: boolean,
  ) {
    this.fileService = fileService;
    this.itemService = itemService;
    this.storageService = storageService;
    this.itemThumbnailService = itemThumbnailService;
    this.shouldRedirectOnDownload = shouldRedirectOnDownload;
  }

  async upload(
    actor: Member,
    repositories,
    {
      description,
      parentId,
      filename,
      mimetype,
      stream,
    }: {
      description?: string;
      parentId?: string;
      filename;
      mimetype: string;
      stream: Readable;
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
        await this.fileService.delete(actor, filepath);
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
        type: this.fileService.type,
        extra: {
          // this is needed because if we directly use `this.fileService.type` then TS widens the type to `string` which we do not want
          ...(this.fileService.type === ItemType.LOCAL_FILE
            ? { [ItemType.LOCAL_FILE]: fileProperties }
            : { [ItemType.S3_FILE]: fileProperties }),
        },
        creator: actor,
      };

      const newItem = await this.itemService.post(actor, repositories, {
        item,
        parentId,
      });

      // add thumbnails if image
      // allow failures
      if (MimeTypes.isImage(mimetype)) {
        try {
          await this.itemThumbnailService.upload(
            actor,
            repositories,
            newItem.id,
            fs.createReadStream(path),
          );
        } catch (e) {
          console.error(e);
        }
      }

      // retrieve item again since hasThumbnail might have changed
      return repositories.itemRepository.get(newItem.id);
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
    const item = await repositories.itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);
    const extraData = item.extra[this.fileService.type] as FileItemProperties;
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
    const item = await repositories.itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);
    const extraData = item.extra[this.fileService.type] as FileItemProperties;
    const result = await this.fileService.getUrl(actor, {
      id: itemId,
      ...extraData,
    });

    return result;
  }

  async copy(actor: Member, repositories: Repositories, { copy }: { original; copy }) {
    const { id, extra } = copy; // full copy with new `id`
    const { path: originalPath, mimetype } = extra[this.fileService.type];
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
    const filepath = await this.fileService.copy(actor, data);

    // update item copy's 'extra'
    if (this.fileService.type === ItemType.S3_FILE) {
      await repositories.itemRepository.patch(copy.id, {
        extra: { s3File: { ...extra.s3File, path: filepath } },
      });
    } else {
      await repositories.itemRepository.patch(copy.id, {
        extra: { file: { ...extra.s3File, path: filepath } },
      });
    }
  }
}

export default FileItemService;
