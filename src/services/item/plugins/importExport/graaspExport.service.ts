import path from 'path';
import { Readable } from 'stream';
import { singleton } from 'tsyringe';
import { v4 } from 'uuid';
import { ZipFile } from 'yazl';

import { ThumbnailSize } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { AppSettingRaw, ItemRaw } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import { MaybeUser } from '../../../../types';
import { isItemType } from '../../discrimination';
import { ItemService } from '../../item.service';
import { AppSettingRepository } from '../app/appSetting/appSetting.repository';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
import { GRAASP_MANIFEST_FILENAME } from './constants';
import { UnexpectedExportError } from './errors';
import { GraaspExportItem } from './import.service';
import { ItemExportService } from './itemExport.service';
import { generateThumbnailFilename } from './utils';

@singleton()
export class GraaspExportService {
  private readonly appSettingRepository: AppSettingRepository;
  private readonly itemExportService: ItemExportService;
  private readonly itemService: ItemService;
  private readonly itemThumbnailService: ItemThumbnailService;
  private readonly log: BaseLogger;

  constructor(
    appSettingRepository: AppSettingRepository,
    itemExportService: ItemExportService,
    itemService: ItemService,
    itemThumbnailService: ItemThumbnailService,
    log: BaseLogger,
  ) {
    this.itemService = itemService;
    this.itemThumbnailService = itemThumbnailService;
    this.itemExportService = itemExportService;
    this.appSettingRepository = appSettingRepository;
    this.log = log;
  }

  /**
   * Export the items recursively in the Graasp export format
   * @param item The root item
   * @returns A zip file promise
   */
  async exportGraasp(dbConnection: DBConnection, actor: MaybeUser, item: ItemRaw) {
    // init archive
    const archive = new ZipFile();
    archive.outputStream.on('error', function (err) {
      throw new UnexpectedExportError(err);
    });
    // path used to index files in archive
    const rootPath = path.dirname('./');

    const manifest = await this.addItemToGraaspExport(dbConnection, actor, {
      item,
      archive,
      itemManifest: [],
    }).catch((error) => {
      throw new UnexpectedExportError(error);
    });

    archive.addReadStream(
      Readable.from(JSON.stringify(manifest)),
      path.join(rootPath, GRAASP_MANIFEST_FILENAME),
    );

    archive.end();
    return archive;
  }

  /**
   * Try and get the item thumbnail and write it to the zip archive.
   * @returns Thumbnail filename, undefined if the thumbnail was not found.
   */
  private async getAndWriteThumbnail(
    dbConnection: DBConnection,
    actor: MaybeUser,
    itemId: string,
    exportItemId: string,
    archive: ZipFile,
  ) {
    const filename = generateThumbnailFilename(exportItemId);
    const itemThumbnailPath = path.join(path.dirname('./'), filename);
    try {
      const thumbnailStream = await this.itemThumbnailService.getFile(dbConnection, actor, {
        size: ThumbnailSize.Original,
        itemId,
      });

      archive.addReadStream(thumbnailStream, itemThumbnailPath);
      return filename;
    } catch (_err) {
      this.log.debug(`Thumbnail not found for item ${itemId}`);
    }
  }

  /**
   * Recursively add items to the Graasp export file.
   *
   * Note that the shortcut items are excluded for now, they will be included in a later release.
   * @param args item - the item to add
   *             archive - reference to the zip file to which the files will be written
   *             itemManifest - reference to the item manifest list
   * @returns A full manifest promise for the given item
   */
  private async addItemToGraaspExport(
    dbConnection: DBConnection,
    actor: MaybeUser,
    args: {
      item: ItemRaw;
      archive: ZipFile;
      itemManifest: GraaspExportItem[];
    },
  ) {
    const { item, archive, itemManifest } = args;

    // assign the uuid to the exported items
    const exportItemId = v4();
    const itemPath = path.join(path.dirname('./'), exportItemId);

    // add the thumbnail to export, if present
    const thumbnailFilename = await this.getAndWriteThumbnail(
      dbConnection,
      actor,
      item.id,
      exportItemId,
      archive,
    );

    // Get the app settings if an item is an APP
    let appSettings: Omit<AppSettingRaw, 'id'>[] | undefined = undefined;
    if (isItemType(item, 'app')) {
      const itemAppSettings = await this.appSettingRepository.getForItem(dbConnection, item.id);

      appSettings = itemAppSettings.map((appSetting) => {
        return { ...appSetting, id: undefined, itemId: exportItemId };
      });
    }

    // TODO EXPORT treat the shortcut items correctly
    // ignore the shortcuts for now
    if (isItemType(item, 'shortcut')) {
      return itemManifest;
    }

    // treat folder items recursively
    const childrenManifest: GraaspExportItem[] = [];
    if (isItemType(item, 'folder')) {
      const childrenItems = await this.itemService.getChildren(dbConnection, actor, item.id);
      for (const child of childrenItems) {
        await this.addItemToGraaspExport(dbConnection, actor, {
          item: child,
          archive,
          itemManifest: childrenManifest,
        });
      }

      itemManifest.push({
        id: exportItemId,
        name: item.name,
        description: item.description,
        type: item.type,
        settings: item.settings,
        extra: item.extra,
        thumbnailFilename,
        children: childrenManifest,
      });
      return itemManifest;
    }

    // treat single items
    const { stream, mimetype } = await this.itemExportService.fetchItemData(
      dbConnection,
      actor,
      item,
    );

    itemManifest.push({
      id: exportItemId,
      name: item.name,
      description: item.description,
      type: item.type,
      settings: item.settings,
      extra: item.extra,
      thumbnailFilename,
      mimetype,
      appSettings,
    });
    archive.addReadStream(stream, itemPath);
    return itemManifest;
  }
}
