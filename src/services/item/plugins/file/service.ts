import fs from 'fs';
import path from 'path';

import { SavedMultipartFile } from '@fastify/multipart';
import { FastifyReply } from 'fastify';

import { ItemType, LocalFileItemExtra, PermissionLevel, S3FileItemExtra } from '@graasp/sdk';

import { Repositories } from '../../../../util/repositories';
import { validatePermission } from '../../../authorization';
import FileService from '../../../file/service';
import { Member } from '../../../member/entities/member';
import { StorageExceeded } from './utils/errors';

const randomHexOf4 = () => ((Math.random() * (1 << 16)) | 0).toString(16).padStart(4, '0');

class FileItemService {
  fileService: FileService;
  shouldRedirectOnDownload: boolean;
  options: {
    maxMemberStorage: number;
  };

  buildFilePath() {
    // TODO: CHANGE ??
    const filepath = `${randomHexOf4()}/${randomHexOf4()}/${randomHexOf4()}-${Date.now()}`;
    return path.join('files', filepath);
  }

  constructor(fileService: FileService, shouldRedirectOnDownload: boolean, options) {
    this.fileService = fileService;
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

  async upload(actor, repositories: Repositories, files: SavedMultipartFile[], parentId: string) {
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
      const fileBody = Object.fromEntries(
        Object.keys(fields).map((key) => [
          key,
          (fields[key] as unknown as { value: string })?.value,
        ]),
      );
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
    return Promise.all(promises);
  }

  async download(
    actor,
    repositories: Repositories,
    { reply, itemId, replyUrl }: { reply: FastifyReply; itemId: string; replyUrl: boolean },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await repositories.itemRepository.get(itemId);
    await validatePermission(repositories, PermissionLevel.Read, actor, item);

    const result = await this.fileService.download(actor, {
      reply: this.shouldRedirectOnDownload ? reply : null,
      id: itemId,
      replyUrl,
      ...item.extra[this.fileService.type],
    });

    return result;
  }

  async copy(actor, repositories: Repositories, { original, copy }) {
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
