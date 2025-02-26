import path from 'path';
import { Readable } from 'stream';
import { singleton } from 'tsyringe';
import { v4 } from 'uuid';

import { FastifyBaseLogger } from 'fastify';

import { H5PItemExtra, ItemType } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { BaseLogger } from '../../../../../logger';
import {
  H5P_FILE_STORAGE_CONFIG,
  H5P_FILE_STORAGE_TYPE,
  H5P_PATH_PREFIX,
} from '../../../../../utils/config';
import { Member } from '../../../../member/entities/member';
import { StorageService } from '../../../../member/plugins/storage/service';
import { Item } from '../../../entities/Item';
import { ItemService } from '../../../service';
import { HtmlService } from '../service';
import { H5P_FILE_DOT_EXTENSION, H5P_FILE_MIME_TYPE } from './constants';
import { H5P } from './validation/h5p';
import { H5PValidator } from './validation/h5p-validator';

/**
 * Implementation for the H5P service
 */
@singleton()
export class H5PService extends HtmlService {
  private readonly itemService: ItemService;

  constructor(itemService: ItemService, storageService: StorageService, log: BaseLogger) {
    const h5pValidator = new H5PValidator();

    super(
      { config: H5P_FILE_STORAGE_CONFIG, type: H5P_FILE_STORAGE_TYPE },
      storageService,
      H5P_PATH_PREFIX,
      H5P_FILE_MIME_TYPE,
      'h5p',
      h5pValidator,
      log,
    );

    this.itemService = itemService;
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
  getUrl(item: Item<typeof ItemType.H5P>) {
    const h5pPath = item.extra.h5p.h5pFilePath;
    return super._getUrl(item.id, h5pPath);
  }

  async copy(
    db: DBConnection,
    member: Member,
    {
      original: item,
      copy,
    }: { original: Item<typeof ItemType.H5P>; copy: Item<typeof ItemType.H5P> },
  ): Promise<void> {
    const { extra } = item;

    const baseName = path.basename(item.name, H5P_FILE_DOT_EXTENSION);
    const copySuffix = '-1';
    const newName = `${baseName}${copySuffix}`;

    const newContentId = v4();
    const remoteRootPath = this.buildRootPath(this.pathPrefix, newContentId);

    // copy .h5p file
    await this.fileService.copy(member, {
      originalPath: path.join(this.pathPrefix, extra.h5p.h5pFilePath),
      newFilePath: this.buildH5PPath(remoteRootPath, newName),
    });
    // copy content folder
    await this.fileService.copyFolder({
      originalFolderPath: path.join(this.pathPrefix, extra.h5p.contentFilePath),
      newFolderPath: this.buildContentPath(remoteRootPath),
    });

    await repositories.itemRepository.updateOne(db, copy.id, {
      name: this.buildH5PPath('', newName),
      extra: { h5p: this.buildH5PExtra(newContentId, newName).h5p },
    });
  }

  async createH5PItem(
    db: DBConnection,
    actor: Member,
    filename: string,
    stream: Readable,
    parentId?: Item['id'],
    previousItemId?: Item['id'],
    log?: FastifyBaseLogger,
  ): Promise<Item> {
    return super.createItem(
      actor,
      repositories,
      filename,
      stream,
      this.createItemForH5PFile,
      parentId,
      previousItemId,
      log,
    );
  }

  /**
   * Creates a Graasp item for the uploaded H5P package
   * @param filename Name of the original H5P file WITHOUT EXTENSION
   * @param contentId Storage ID of the remote content
   * @param remoteRootPath Root path on the remote storage
   * @param member Actor member
   * @param parentId Optional parent id of the newly created item
   */
  private createItemForH5PFile = async (
    db: DBConnection,
    member: Member,
    filename: string,
    contentId: string,
    parentId?: string,
    previousItemId?: string,
  ): Promise<Item> => {
    const metadata = {
      name: this.buildH5PPath('', filename),
      type: ItemType.H5P,
      extra: this.buildH5PExtra(contentId, filename),
    };
    return this.itemService.post(db, member, {
      item: metadata,
      parentId,
      previousItemId,
    });
  };
}
