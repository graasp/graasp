import fs, { existsSync } from 'fs';
import { createReadStream, exists } from 'fs-extra';
import { readFile } from 'fs/promises';
import mimetics from 'mimetics';
import path from 'path';
import sanitize from 'sanitize-html';
import { Readable } from 'stream';
import { singleton } from 'tsyringe';

import { type DocumentItemExtraProperties, type ItemSettings } from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import type { AppSettingInsertDTO, AppSettingRaw } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import { ItemType } from '../../../../schemas/global';
import type { MinimalMember } from '../../../../types';
import { AuthorizedItemService } from '../../../authorizedItem.service';
import { UploadEmptyFileError } from '../../../file/utils/errors';
import { type ItemRaw, isFolderItem } from '../../item';
import { ItemService } from '../../item.service';
import { AppSettingRepository } from '../app/appSetting/appSetting.repository';
import FileItemService from '../file/itemFile.service';
import { H5PService } from '../html/h5p/h5p.service';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';
import {
  DESCRIPTION_EXTENSION,
  GRAASP_DOCUMENT_EXTENSION,
  GRAASP_MANIFEST_FILENAME,
  HTML_EXTENSION,
  LINK_EXTENSION,
  TXT_EXTENSION,
  URL_PREFIX,
} from './constants';
import { GraaspExportInvalidFileError } from './errors';
import { ItemExportService } from './itemExport.service';
import { generateThumbnailFilename } from './utils';

/**
 * Defines the properties of an individual item in the graasp export format.
 * @property children Children items, if the item if of type FOLDER.
 * @property mimetype Mimetype of the item. Present if the item is not of type FOLDER.
 */
export type GraaspExportItem = {
  id: string;
  name: string;
  type: ItemType;
  description: string | null;
  settings: ItemSettings;
  extra: object;
  thumbnailFilename?: string;
  children?: GraaspExportItem[];
  mimetype?: string;
  appSettings?: Omit<AppSettingRaw, 'id'>[];
};

@singleton()
export class ImportService {
  private readonly fileItemService: FileItemService;
  private readonly h5pService: H5PService;
  private readonly itemService: ItemService;
  private readonly authorizedItemService: AuthorizedItemService;
  private readonly appSettingRepository: AppSettingRepository;

  private readonly log: BaseLogger;

  constructor(
    fileItemService: FileItemService,
    itemService: ItemService,
    h5pService: H5PService,
    authorizedItemService: AuthorizedItemService,
    itemThumbnailService: ItemThumbnailService,
    appSettingRepository: AppSettingRepository,
    itemExportService: ItemExportService,

    log: BaseLogger,
  ) {
    this.fileItemService = fileItemService;
    this.h5pService = h5pService;
    this.itemService = itemService;
    this.authorizedItemService = authorizedItemService;
    this.appSettingRepository = appSettingRepository;
    this.log = log;
  }

  private async _getDescriptionForFilepath(filepath: string): Promise<string> {
    const descriptionFilePath = filepath + DESCRIPTION_EXTENSION;
    if (existsSync(descriptionFilePath)) {
      // get folder description (inside folder) if it exists
      const text = await readFile(descriptionFilePath, {
        encoding: 'utf8',
        flag: 'r',
      });
      return sanitize(text);
    }
    return '';
  }

  /**
   * private function that create an item and its necessary membership with given parameters
   * @param {Member} actor creator
   * @param {any} options.filename filename of the file to import
   * @returns {any}
   */
  private async saveItemFromFilename(
    dbConnection: DBConnection,
    actor: MinimalMember,
    options: {
      filename: string;
      folderPath: string;
      parentId?: string;
    },
  ): Promise<ItemRaw | null> {
    const { filename, folderPath, parentId } = options;

    this.log.debug(`handling '${filename}'`);

    // ignore hidden files such as .DS_STORE
    if (filename.startsWith('.')) {
      return null;
    }

    const filepath = path.join(folderPath, filename);
    const stats = fs.lstatSync(filepath);

    // ignore empty files
    if (!stats.size) {
      return null;
    }

    // folder
    if (stats.isDirectory()) {
      // element has no extension -> folder

      const description = await this._getDescriptionForFilepath(path.join(filepath, filename));

      this.log.debug(`create folder from '${filename}'`);
      return this.itemService.post(dbConnection, actor, {
        item: {
          description,
          name: filename,
          type: 'folder',
          extra: { ['folder']: {} },
        },
        parentId,
      });
    }
    // string content
    // todo: optimize to avoid reading the file twice in case of upload
    const content = await readFile(filepath, {
      encoding: 'utf8',
      flag: 'r',
    });
    const description = await this._getDescriptionForFilepath(filepath);

    const { name, ext } = path.parse(filename);

    // links and apps
    switch (ext) {
      case LINK_EXTENSION: {
        const [_source, link, linkType] = content.split('\n');

        // get url from content
        const url = link.slice(URL_PREFIX.length);

        // get if app in content -> url is either a link or an app
        const type = linkType.includes('1') ? ('app' as const) : ('embeddedLink' as const);
        if (type === 'app') {
          const newItem = {
            name,
            description,
            type,
            extra: {
              [type]: {
                url,
              },
            },
          };
          return this.itemService.post(dbConnection, actor, {
            item: newItem,
            parentId,
          });
        } else if (type === 'embeddedLink') {
          const newItem = {
            name,
            description,
            type,
            extra: {
              [type]: {
                url,
              },
            },
          };
          return this.itemService.post(dbConnection, actor, {
            item: newItem,
            parentId,
          });
        } else {
          throw new Error(`${type} is not handled`);
        }
      }
      case GRAASP_DOCUMENT_EXTENSION:
      case HTML_EXTENSION:
      case TXT_EXTENSION: {
        const newItem = {
          name,
          description,
          type: 'document' as const,
          extra: {
            ['document']: {
              content: sanitize(content),
            },
          },
        };
        return this.itemService.post(dbConnection, actor, {
          item: newItem,
          parentId,
        });
      }

      // normal files
      default: {
        // TODO: replace by file-type library once we are in ESM
        const fileTypeAnalysis = await mimetics.parseAsync(fs.readFileSync(filepath));
        const mimetype = fileTypeAnalysis?.mime ?? 'text/plain';

        // upload file
        const file = fs.createReadStream(filepath);
        const item = await this.fileItemService.uploadFileAndCreateItem(dbConnection, actor, {
          filename,
          mimetype,
          description,
          stream: file,
          parentId,
        });

        return item;
      }
    }
  }

  private async readAndImportGraaspFile(
    dbConnection: DBConnection,
    actor: MinimalMember,
    args: {
      folderPath: string;
      parentId: string;
    },
  ) {
    const { folderPath, parentId } = args;

    const manifestFilePath = path.join(folderPath, GRAASP_MANIFEST_FILENAME);
    const graaspManifestFile = await readFile(manifestFilePath, {
      encoding: 'utf8',
      flag: 'r',
    });

    const items = JSON.parse(graaspManifestFile) as GraaspExportItem[];

    return this.importManifestItems(dbConnection, actor, { items, folderPath, parentId });
  }

  private async importManifestItems(
    dbConnection: DBConnection,
    actor: MinimalMember,
    args: {
      items: GraaspExportItem[];
      folderPath: string;
      parentId: string;
    },
  ) {
    const { items, folderPath, parentId } = args;

    // Sanitize the items and add the thumbnails, if any
    const augmentedItems = await Promise.all(
      items.map(async (item) => {
        const sanitizedDescription = item.description ? sanitize(item.description) : null;
        let extra;

        // Sanitize the document content
        if (item.type === 'document') {
          if (!item.extra) {
            throw new GraaspExportInvalidFileError();
          }

          const documentExtraProps = item.extra['document'] as DocumentItemExtraProperties;
          const content = documentExtraProps.content;
          const sanitizedContent = sanitize(content);
          extra = { ['document']: { content: sanitizedContent } };
        }

        // Find and upload the thumbnail
        let thumbnail: Readable | undefined = undefined;
        const itemThumbnailPath = path.join(folderPath, generateThumbnailFilename(item.id));
        if (await exists(itemThumbnailPath)) {
          thumbnail = createReadStream(itemThumbnailPath);
        }

        // Handle the H5P file upload
        if (item.type === 'h5p') {
          const pathToGraaspFile = path.join(folderPath, item.id);
          const h5pFileStream = createReadStream(pathToGraaspFile);
          const h5pFileInfo = await this.h5pService.uploadH5PFile(
            dbConnection,
            actor,
            item.id,
            h5pFileStream,
          );

          extra = { ['h5p']: h5pFileInfo };
        }

        // Handle the APP item extra
        if (item.type === 'app') {
          extra = item.extra;
        }

        // Handle the file upload
        if (item.type === 'file') {
          if (!item.mimetype) {
            throw new GraaspExportInvalidFileError();
          }

          const pathToGraaspFile = path.join(folderPath, item.id);
          const fileItemProperties = await this.fileItemService.uploadFile(dbConnection, actor, {
            filename: item.name,
            filepath: pathToGraaspFile,
            mimetype: item.mimetype,
          });

          extra = {
            ['file']: fileItemProperties,
          };
        }

        const augmentedItem = { ...item, description: sanitizedDescription, extra };

        return { item: augmentedItem, thumbnail };
      }),
    );

    // Create the items in the DB
    const uploadedItems = await this.itemService.postMany(dbConnection, actor, {
      items: augmentedItems,
      parentId: parentId,
    });

    // Create the app settings for the APP items
    await this.insertAppSettings(dbConnection, actor, uploadedItems, items);

    // Recursively handle the children items
    for (let i = 0; i < items.length; i++) {
      if (items[i].type === 'folder') {
        const children = items[i].children;
        if (children && children.length) {
          const createdFolderItem = uploadedItems[i];
          await this.importManifestItems(dbConnection, actor, {
            items: children,
            folderPath,
            parentId: createdFolderItem.id,
          });
        }
      }
    }
  }

  /**
   * Extract the app settings from the export items and attach them to the existing items in the DB.
   */
  private async insertAppSettings(
    dbConnection: DBConnection,
    actor: MinimalMember,
    uploadedItems: ItemRaw[],
    items: GraaspExportItem[],
  ): Promise<void> {
    const appSettings = uploadedItems.reduce<Omit<AppSettingInsertDTO[], 'id'>>(
      (arr, uploadedItem, idx) => {
        const settings = items[idx].appSettings;
        if (uploadedItem.type !== 'app' || !settings) {
          return arr;
        }

        return arr.concat(
          settings.reduce<Omit<AppSettingInsertDTO[], 'id'>>((arr, appSetting) => {
            // ignore app setting file
            if (appSetting.data['file']) {
              return arr;
            }

            // Remove the id property from the imported app settings as a precaution. Remove this condition as soon as the id is stripped directly in the post function.
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, creatorId, itemId, ...appSettingData } = appSetting;

            return arr.concat([
              { creatorId: actor.id, itemId: uploadedItem.id, ...appSettingData },
            ]);
          }, []),
        );
      },
      [],
    );
    if (appSettings.length) {
      await this.appSettingRepository.createMany(dbConnection, appSettings);
    }
  }

  private async importGraaspFile(
    dbConnection: DBConnection,
    actor: MinimalMember,
    { parentId, folderPath }: { parentId: string; folderPath: string },
  ) {
    try {
      await dbConnection.transaction(async (tx) => {
        await this.readAndImportGraaspFile(tx, actor, {
          folderPath,
          parentId,
        });
      });
    } catch (e) {
      this.log.error(e);
      throw e;
    }
  }

  private async importFiles(
    dbConnection: DBConnection,
    actor: MinimalMember,
    { parentId, folderPath }: { parentId?: string; folderPath: string },
  ) {
    const filenames = fs.readdirSync(folderPath);

    const items: ItemRaw[] = [];
    for (const filename of filenames) {
      // import item from file excluding descriptions
      // descriptions are handled alongside the corresponding file
      if (!filename.endsWith(DESCRIPTION_EXTENSION)) {
        try {
          // transaction is necessary since we are adding data
          // we don't add it at the very top to allow partial zip to be updated
          await dbConnection.transaction(async (tx) => {
            const item = await this.saveItemFromFilename(tx, actor, {
              filename,
              folderPath,
              parentId,
            });
            if (item) {
              items.push(item);
            }
          });
        } catch (e) {
          if (e instanceof UploadEmptyFileError) {
            // ignore empty files
            this.log.debug(`ignore ${filename} because it is empty`);
          } else {
            // improvement: return a list of failed imports
            this.log.error(e);
            throw e;
          }
        }
      }
    }

    // recursively create children in folders
    for (const newItem of items) {
      const { name } = newItem;
      if (isFolderItem(newItem)) {
        await this.importFiles(dbConnection, actor, {
          folderPath: path.join(folderPath, name),
          parentId: newItem.id,
        });
      }
    }
  }

  /**
   * Util recursive function that create graasp item given folder content
   * @param actor
   * @param repositories
   * @param options.parent parent item might be saved in
   * @param options.folderPath current path in archive of the parent
   */
  private async _import(
    dbConnection: DBConnection,
    actor: MinimalMember,
    { parentId, folderPath }: { parentId?: string; folderPath: string },
  ) {
    const filenames = fs.readdirSync(folderPath);

    if (filenames.includes(GRAASP_MANIFEST_FILENAME)) {
      if (!parentId) {
        throw new Error('The graasp import needs a parent item');
      }

      await this.importGraaspFile(dbConnection, actor, { parentId, folderPath });
    } else {
      await this.importFiles(dbConnection, actor, { parentId, folderPath });
    }
  }

  async import(
    dbConnection: DBConnection,
    member: MinimalMember,
    {
      folderPath,
      targetFolder,
      parentId,
    }: { folderPath: string; targetFolder: string; parentId?: string },
  ): Promise<void> {
    if (parentId) {
      // check item permission
      await this.authorizedItemService.assertAccessForItemId(dbConnection, {
        accountId: member.id,
        itemId: parentId,
      });
    }

    await this._import(dbConnection, member, { parentId, folderPath });

    // delete zip and content
    fs.rmSync(targetFolder, { recursive: true });
  }
}
