import fs from 'fs';
import path from 'path';

import { SavedMultipartFile } from '@fastify/multipart';
import { FastifyReply } from 'fastify';

import {
  FileItemProperties,
  FileItemType,
  ItemType,
  LocalFileItemExtra,
  LocalFileItemType,
  PermissionLevel,
  S3FileItemExtra,
  S3FileItemType,
} from '@graasp/sdk';

import { UnauthorizedMember } from '../../../../utils/errors';
import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import FileService from '../../../file/service';
import { Actor, Member } from '../../../member/entities/member';
import { randomHexOf4 } from '../../../utils';
import { Item } from '../../entities/Item';
import ItemService from '../../service';
import { StorageExceeded } from './utils/errors';

const ORIGINAL_FILENAME_TRUNCATE_LIMIT = 20;

type Options = {
  maxMemberStorage: number;
};

class FileItemService {
  fileService: FileService;
  itemService: ItemService;
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
    shouldRedirectOnDownload: boolean,
    options: Options,
  ) {
    this.fileService = fileService;
    this.itemService = itemService;
    this.shouldRedirectOnDownload = shouldRedirectOnDownload;
    this.options = options;
  }

  // check the user has enough storage to create a new item given its size
  // get the complete storage
  async checkRemainingStorage(actor: Member, repositories: Repositories, size?: number) {
    if (!size) {
      return;
    }

    const { id: memberId } = actor;

    const currentStorage = await repositories.memberRepository.getMemberStorage(
      memberId,
      this.fileService.type,
    );

    if (currentStorage + size > this.options.maxMemberStorage) {
      throw new StorageExceeded();
    }
  }

  async upload(
    actor: Actor,
    repositories: Repositories,
    files: (Partial<SavedMultipartFile> &
      Pick<SavedMultipartFile, 'filename' | 'mimetype' | 'filepath'>)[],
    parentId: string,
  ) {
    if (!actor) {
      throw new UnauthorizedMember(actor);
    }

    // TODO: check rights
    if (parentId) {
      const item = await repositories.itemRepository.get(parentId);
      await validatePermission(repositories, PermissionLevel.Write, actor, item);
    }

    const promises: Promise<{
      filepath: string;
      filename: string;
      size: number;
      mimetype: string;
    }>[] = [];
    for (const fileObject of files) {
      const { filename, mimetype, fields, filepath: tmpPath } = fileObject;
      const file = fs.createReadStream(tmpPath);
      const { size } = fs.statSync(tmpPath);
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
      await this.checkRemainingStorage(actor, repositories, size);

      promises.push(
        this.fileService
          .upload(actor, {
            file,
            filepath,
            mimetype,
            size,
          })
          .then(() => {
            return { filepath, filename, size, mimetype };
          })
          .catch((e) => {
            throw e;
          }),
      );
    }

    // TODO: CHUNK TO AVOID FLOODING
    // fallback?
    const fileProperties = await Promise.all(promises);

    const items: Item[] = [];
    // postHook: create items from file properties
    for (const { filename, filepath, mimetype, size } of fileProperties) {
      const name = filename.substring(0, ORIGINAL_FILENAME_TRUNCATE_LIMIT);
      const item = {
        name,
        type: this.fileService.type,
        extra: {
          [this.fileService.type]: {
            name: filename,
            path: filepath,
            mimetype,
            size,
          },
        } as any,
        settings: {
          // image files get automatically generated thumbnails
          hasThumbnail: mimetype.startsWith('image'),
        },
        parentId,
        creator: actor,
      };

      items.push(
        await this.itemService.post(actor, repositories, {
          item,
          parentId,
        }),
      );
    }
    return items;
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
      (copy.extra as S3FileItemExtra).s3File.path = filepath;
    } else {
      (copy.extra as LocalFileItemExtra).file.path = filepath;
    }
  }
}

export default FileItemService;
