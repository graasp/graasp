import path from 'path';
import { v4 } from 'uuid';

import { FastifyBaseLogger } from 'fastify';

import { H5PItemExtra, ItemType, UUID } from '@graasp/sdk';

import {
  H5P_FILE_STORAGE_CONFIG,
  H5P_FILE_STORAGE_TYPE,
  H5P_PATH_PREFIX,
} from '../../../../../utils/config';
import { Repositories } from '../../../../../utils/repositories';
import { Actor, Member } from '../../../../member/entities/member';
import { H5PItem, Item } from '../../../entities/Item';
import { HtmlService } from '../service';
import { H5P_FILE_DOT_EXTENSION, H5P_FILE_MIME_TYPE } from './constants';
import { H5P } from './validation/h5p';
import { H5PValidator } from './validation/h5p-validator';

/**
 * Implementation for the H5P service
 */
export class H5PService extends HtmlService {
  constructor(log: FastifyBaseLogger) {
    const h5pValidator = new H5PValidator();

    super(
      { config: H5P_FILE_STORAGE_CONFIG, type: H5P_FILE_STORAGE_TYPE },
      H5P_PATH_PREFIX,
      H5P_FILE_MIME_TYPE,
      'h5p',
      h5pValidator,
      log,
    );
  }

  /**
   * Helper to create H5P extra
   */
  buildH5PExtra(contentId: string, filename: string): H5PItemExtra {
    return {
      h5p: {
        contentId,
        h5pFilePath: this.buildPackagePath(contentId, filename),
        contentFilePath: this.buildContentPath(contentId),
      },
    };
  }

  /**
   * Helper to build the local or remote path of the .h5p file
   */
  buildH5PPath = (rootPath: string, filename: string) =>
    path.join(rootPath, `${filename}.${H5P.H5P_FILE_EXTENSION}`);

  /**
   * Get the H5P file url referenced by a given Item
   */
  getUrl(item: Item<typeof ItemType.H5P>, member: Actor) {
    const h5pPath = item.extra.h5p.h5pFilePath;
    return super._getUrl(member, item.id, h5pPath);
  }

  async copy(actor: Member, repositories: Repositories, id: string, args: { parentId?: UUID }) {
    // copy item
    const { item, copy } = await super.copy(actor, repositories, id, args);

    // not good, we should infer from super copy, but not so easy
    const { extra } = item as H5PItem;

    const baseName = path.basename(item.name, H5P_FILE_DOT_EXTENSION);
    const copySuffix = '-1';
    const newName = `${baseName}${copySuffix}`;

    const newContentId = v4();
    const remoteRootPath = this.buildRootPath(this.pathPrefix, newContentId);

    // copy .h5p file
    await this.fileService.copy(actor, {
      originalPath: path.join(this.pathPrefix, extra.h5p.h5pFilePath),
      newFilePath: this.buildH5PPath(remoteRootPath, newName),
    });
    // copy content folder
    await this.fileService.copyFolder(actor, {
      originalFolderPath: path.join(this.pathPrefix, extra.h5p.contentFilePath),
      newFolderPath: this.buildContentPath(remoteRootPath),
    });

    const changedCopy = await repositories.itemRepository.patch(copy.id, {
      name: this.buildH5PPath('', newName),
      extra: { h5p: this.buildH5PExtra(newContentId, newName).h5p },
    });

    return { item, copy: changedCopy };
  }

  async delete(actor: Member, repositories: Repositories, itemId: UUID) {
    const item = await super.delete(actor, repositories, itemId);
    const { extra } = item as H5PItem;
    await this.deletePackage(actor, extra.h5p.contentId);

    return item;
  }
}
