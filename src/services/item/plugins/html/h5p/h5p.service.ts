import path from 'path';
import { Readable } from 'stream';
import { singleton } from 'tsyringe';
import { v4 } from 'uuid';

import { FastifyBaseLogger } from 'fastify';

import { H5PItemExtra, ItemType } from '@graasp/sdk';

import { DBConnection } from '../../../../../drizzle/db';
import { type ItemRaw, ItemWithType } from '../../../../../drizzle/types';
import { BaseLogger } from '../../../../../logger';
import { MinimalMember } from '../../../../../types';
import {
  H5P_FILE_STORAGE_CONFIG,
  H5P_FILE_STORAGE_TYPE,
  H5P_PATH_PREFIX,
} from '../../../../../utils/config';
import { StorageService } from '../../../../member/plugins/storage/memberStorage.service';
import { H5PItem, isItemType } from '../../../discrimination';
import { ItemRepository } from '../../../item.repository';
import { ItemService } from '../../../item.service';
import { HtmlService } from '../html.service';
import { H5P_FILE_DOT_EXTENSION, H5P_FILE_MIME_TYPE } from './constants';
import { H5P } from './validation/h5p';
import { H5PValidator } from './validation/h5p-validator';

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
      { config: H5P_FILE_STORAGE_CONFIG, fileStorageType: H5P_FILE_STORAGE_TYPE },
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
  private buildH5PExtra(contentId: string, filename: string): H5PItemExtra {
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
  buildH5PPath = (rootPath: string, filename: string) => {
    return path.join(rootPath, `${filename}.${H5P.H5P_FILE_EXTENSION}`);
  };

  /**
   * Get the H5P file url referenced by a given Item
   */
  getUrl(item: ItemWithType<typeof ItemType.H5P>) {
    const h5pPath = item.extra.h5p.h5pFilePath;
    return super._getUrl(item.id, h5pPath);
  }

  async copy(
    dbConnection: DBConnection,
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

    await this.itemRepository.updateOne(dbConnection, copy.id, {
      name: this.buildH5PPath('', newName),
      extra: { h5p: this.buildH5PExtra(newContentId, newName).h5p },
    });
  }

  /**
   * Upload an H5P file.
   * @returns The H5P file metadata.
   */
  async uploadH5PFile(
    dbConnection: DBConnection,
    actor: MinimalMember,
    filename: string,
    stream: Readable,
    log?: FastifyBaseLogger,
  ) {
    return await super.uploadFile(dbConnection, actor, filename, stream, log);
  }

  /**
   * Upload the H5P file and create an item associated with it.
   * @returns The newly created item.
   */
  async uploadFileAndCreateItem(
    dbConnection: DBConnection,
    actor: MinimalMember,
    filename: string,
    stream: Readable,
    parentId?: ItemRaw['id'],
    previousItemId?: ItemRaw['id'],
    log?: FastifyBaseLogger,
  ): Promise<H5PItem> {
    const { remoteRootPath, baseName, contentId } = await this.uploadH5PFile(
      dbConnection,
      actor,
      filename,
      stream,
      log,
    );

    const metadata = {
      name: this.buildH5PPath('', baseName),
      type: ItemType.H5P,
      extra: this.buildH5PExtra(contentId, baseName),
    };

    try {
      const item = await this.itemService.post(dbConnection, actor, {
        item: metadata,
        parentId,
        previousItemId,
      });

      if (!isItemType(item, ItemType.H5P)) {
        throw new Error('Expected item to be H5P but it was something else');
      }
      return item;
    } catch (error) {
      // delete storage folder of this html package if upload or creation fails
      await this.fileService.deleteFolder(remoteRootPath);
      // rethrow above
      log?.error(error);
      throw error;
    }
  }
}
