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

import { DBConnection } from '../../../../drizzle/db';
import { asDefined } from '../../../../utils/assertions';
import { Repositories } from '../../../../utils/repositories';
import { AuthorizationService } from '../../../authorization';
import FileService from '../../../file/service';
import { UploadEmptyFileError } from '../../../file/utils/errors';
import { Actor, Member } from '../../../member/entities/member';
import { StorageService } from '../../../member/plugins/storage/service';
import { randomHexOf4 } from '../../../utils';
import { Item } from '../../entities/Item';
import { ItemRepository } from '../../repository';
import { ItemService } from '../../service';
import { readPdfContent } from '../../utils';
import { ItemThumbnailService } from '../thumbnail/service';

@singleton()
class FileItemService {
  private readonly fileService: FileService;
  private readonly itemService: ItemService;
  private readonly storageService: StorageService;
  private readonly itemThumbnailService: ItemThumbnailService;
  private readonly authorizationService: AuthorizationService;
  private readonly itemRepository: ItemRepository;

  constructor(
    fileService: FileService,
    itemService: ItemService,
    storageService: StorageService,
    itemThumbnailService: ItemThumbnailService,
    authorizationService: AuthorizationService,
    itemRepository: ItemRepository,
  ) {
    this.fileService = fileService;
    this.itemService = itemService;
    this.storageService = storageService;
    this.itemThumbnailService = itemThumbnailService;
    this.authorizationService = authorizationService;
    this.itemRepository = itemRepository;
  }

  public buildFilePath(extension?: string) {
    // TODO: CHANGE ??
    const filepath = `${randomHexOf4()}/${randomHexOf4()}/${randomHexOf4()}-${Date.now()}${extension}`;
    return path.join('files', filepath);
  }

  async upload(
    db: DBConnection,
    actor: Member,
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
    await this.storageService.checkRemainingStorage(db, actor);

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

      const newItem = await this.itemService.post(db, actor, {
        item,
        parentId,
        previousItemId,
      });

      // add thumbnails if image or pdf
      // allow failures
      try {
        if (MimeTypes.isImage(mimetype)) {
          await this.itemThumbnailService.upload(db, actor, newItem.id, fs.createReadStream(path));
        } else if (MimeTypes.isPdf(mimetype)) {
          // Convert first page of PDF to image buffer and upload as thumbnail
          const outputImg = await convertPDFtoImageFromPath(path)(1, { responseType: 'buffer' });
          const buffer = asDefined(outputImg.buffer);
          await this.itemThumbnailService.upload(db, actor, newItem.id, Readable.from(buffer));
        }
      } catch (e) {
        console.error(e);
      }

      // retrieve item again since hasThumbnail might have changed
      return await this.itemRepository.getOneOrThrow(db, newItem.id);
    });
  }

  async getFile(
    db: DBConnection,
    actor: Actor,
    {
      itemId,
    }: {
      itemId: string;
    },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await this.itemRepository.getOneOrThrow(db, itemId);
    await this.authorizationService.validatePermission(db, PermissionLevel.Read, actor, item);
    const extraData = item.extra[this.fileService.fileType] as FileItemProperties;
    const result = await this.fileService.getFile(actor, {
      id: itemId,
      ...extraData,
    });

    return result;
  }

  async getUrl(
    db: DBConnection,
    actor: Actor,
    {
      itemId,
    }: {
      itemId: string;
    },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await this.itemRepository.getOneOrThrow(db, itemId);
    await this.authorizationService.validatePermission(db, PermissionLevel.Read, actor, item);
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
      await this.itemRepository.updateOne(db, copy.id, {
        extra: { s3File: { ...extra.s3File, path: filepath } },
      });
    } else {
      await this.itemRepository.updateOne(db, copy.id, {
        extra: { file: { ...extra.s3File, path: filepath } },
      });
    }
  }
}

export default FileItemService;
