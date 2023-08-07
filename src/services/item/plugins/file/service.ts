import path from 'path';
import { PassThrough, Readable } from 'stream';

import { MultipartFields, MultipartFile } from '@fastify/multipart';
import { FastifyReply } from 'fastify';

import {
  FileItemProperties,
  ItemType,
  LocalFileItemExtra,
  MimeTypes,
  PermissionLevel,
  S3FileItemExtra,
} from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import FileService from '../../../file/service';
import { UploadEmptyFileError } from '../../../file/utils/errors';
import { Actor, Member } from '../../../member/entities/member';
import { randomHexOf4 } from '../../../utils';
import { Item } from '../../entities/Item';
import ItemService from '../../service';
import { ItemThumbnailService } from '../thumbnail/service';
import { StorageExceeded } from './utils/errors';

const ORIGINAL_FILENAME_TRUNCATE_LIMIT = 20;

type Options = {
  maxMemberStorage: number;
};

class FileItemService {
  fileService: FileService;
  itemService: ItemService;
  itemThumbnailService: ItemThumbnailService;
  shouldRedirectOnDownload: boolean;
  options: Options;

  buildFilePath() {
    // TODO: CHANGE ??
    const filepath = `${randomHexOf4()}/${randomHexOf4()}/${randomHexOf4()}-${Date.now()}`;
    return path.join('files', filepath);
  }

  constructor(
    fileService: FileService,
    itemService: ItemService,
    itemThumbnailService: ItemThumbnailService,
    shouldRedirectOnDownload: boolean,
    options: Options,
  ) {
    this.fileService = fileService;
    this.itemService = itemService;
    this.itemThumbnailService = itemThumbnailService;
    this.shouldRedirectOnDownload = shouldRedirectOnDownload;
    this.options = options;
  }

  // check the user has enough storage to create a new item given its size
  // get the complete storage
  async checkRemainingStorage(actor: Member, repositories: Repositories, size: number = 0) {
    const { id: memberId } = actor;

    const currentStorage = await repositories.itemRepository.getItemSumSize(
      memberId,
      this.fileService.type,
    );

    if (currentStorage + size > this.options.maxMemberStorage) {
      throw new StorageExceeded(currentStorage + size);
    }
  }

  async upload(
    actor,
    repositories,
    {
      description,
      parentId,
      filename,
      mimetype,
      fields,
      stream,
    }: {
      description?: string;
      parentId?: string;
      filename;
      mimetype;
      fields?: MultipartFields;
      stream: Readable;
    },
  ) {
    const filepath = this.buildFilePath(); // parentId, filename
    // compute body data from file's fields
    if (fields) {
      const fileBody = Object.fromEntries(
        Object.keys(fields).map((key) => [
          key,
          (fields[key] as unknown as { value: string })?.value,
        ]),
      );
    }
    // check member storage limit
    await this.checkRemainingStorage(actor, repositories);

    // duplicate stream to use in thumbnails
    const streamForThumbnails = new PassThrough();
    if (MimeTypes.isImage(mimetype)) {
      stream.pipe(streamForThumbnails);
    }

    try {
      await this.fileService.upload(actor, {
        file: stream,
        filepath,
        mimetype,
      });

      const size = await this.fileService.getFileSize(actor, filepath);

      // throw for empty files
      if (!size) {
        await this.fileService.delete(actor, filepath);
        // Bug: empty stream does not trigger end event, which leads to hang in the for await
        streamForThumbnails.emit('close');
        throw new UploadEmptyFileError();
      }

      // create item from file properties
      const name = filename.substring(0, ORIGINAL_FILENAME_TRUNCATE_LIMIT);
      const item = {
        name,
        description,
        type: this.fileService.type,
        extra: {
          [this.fileService.type]: {
            name: filename,
            path: filepath,
            mimetype,
            size,
          },
          // todo: fix type
        } as any,
        parentId,
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
            streamForThumbnails,
          );
        } catch (e) {
          console.error(e);
        }
      }

      return newItem;
    } finally {
      streamForThumbnails.emit('close');
    }
  }

  async download(
    actor: Actor,
    repositories: Repositories,
    {
      fileStorage,
      itemId,
      reply,
      replyUrl,
    }: {
      fileStorage?: string;
      itemId: string;
      reply?: FastifyReply;
      replyUrl?: boolean;
    },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await repositories.itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);
    const extraData = item.extra[this.fileService.type] as FileItemProperties;
    const result = await this.fileService.download(actor, {
      fileStorage,
      id: itemId,
      reply: this.shouldRedirectOnDownload || !replyUrl ? reply : undefined,
      replyUrl,
      ...extraData,
    });

    return result;
  }

  async copy(actor: Member, repositories: Repositories, { original, copy }: { original; copy }) {
    const { id, extra } = copy; // full copy with new `id`
    const { size, path: originalPath, mimetype } = extra[this.fileService.type];
    // filenames are not used
    const newFilePath = this.buildFilePath();

    const data = {
      newId: id,
      originalPath,
      newFilePath,
      mimetype,
    };

    // check member storage limit
    await this.checkRemainingStorage(actor, repositories, size);

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
