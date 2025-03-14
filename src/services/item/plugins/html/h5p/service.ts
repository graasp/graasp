import path from 'path';
import { Readable } from 'stream';
import { singleton } from 'tsyringe';
import { v4 } from 'uuid';

import type { FastifyBaseLogger } from 'fastify';

import { type H5PItemExtra, ItemType } from '@graasp/sdk';

import type { DBConnection } from '../../../../../drizzle/db.js';
import type { Item, ItemWithType } from '../../../../../drizzle/types.js';
import { BaseLogger } from '../../../../../logger.js';
import type { MinimalMember } from '../../../../../types.js';
import {
  H5P_FILE_STORAGE_CONFIG,
  H5P_FILE_STORAGE_TYPE,
  H5P_PATH_PREFIX,
} from '../../../../../utils/config.js';
import { StorageService } from '../../../../member/plugins/storage/service.js';
import { type H5PItem, isItemType } from '../../../discrimination.js';
import { ItemRepository } from '../../../repository.js';
import { ItemService } from '../../../service.js';
import { HtmlService } from '../service.js';
import { H5P_FILE_DOT_EXTENSION, H5P_FILE_MIME_TYPE } from './constants.js';
import { H5PValidator } from './validation/h5p-validator.js';
import { H5P } from './validation/h5p.js';

/**
 * Implementation for the H5P service
 */
@singleton()
export class H5PService extends HtmlService {
  private readonly itemService: ItemService;
  private readonly itemRepository: ItemRepository;

  constructor(
    itemService: ItemService,
    storageService: StorageService,
    itemRepository: ItemRepository,
    log: BaseLogger,
  ) {
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
    this.itemRepository = itemRepository;
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
  getUrl(item: ItemWithType<typeof ItemType.H5P>) {
    const h5pPath = item.extra.h5p.h5pFilePath;
    return super._getUrl(item.id, h5pPath);
  }

  async copy(
    db: DBConnection,
    member: MinimalMember,
    {
      original: item,
      copy,
    }: {
      original: ItemWithType<typeof ItemType.H5P>;
      copy: ItemWithType<typeof ItemType.H5P>;
    },
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

    await this.itemRepository.updateOne(db, copy.id, {
      name: this.buildH5PPath('', newName),
      extra: { h5p: this.buildH5PExtra(newContentId, newName).h5p },
    });
  }

  async createH5PItem(
    db: DBConnection,
    actor: MinimalMember,
    filename: string,
    stream: Readable,
    parentId?: Item['id'],
    previousItemId?: Item['id'],
    log?: FastifyBaseLogger,
  ): Promise<H5PItem> {
    const item = await super.createItem(
      db,
      actor,
      filename,
      stream,
      this.createItemForH5PFile,
      parentId,
      previousItemId,
      log,
    );
    if (!isItemType(item, ItemType.H5P)) {
      throw new Error('Expected item to be H5P but it was something else');
    }
    return item;
  }

  /**
   * Creates a Graasp item for the uploaded H5P package
   * @param filename Name of the original H5P file WITHOUT EXTENSION
   * @param contentId Storage ID of the remote content
   * @param remoteRootPath Root path on the remote storage
   * @param member Actor member
   * @param parentId Optional parent id of the newly created item
   */
  private async createItemForH5PFile(
    db: DBConnection,
    member: MinimalMember,
    filename: string,
    contentId: string,
    parentId?: string,
    previousItemId?: string,
  ): Promise<Item> {
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
  }
}
