import fs, { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { MAGIC_MIME_TYPE, Magic } from 'mmmagic';
import fetch from 'node-fetch';
import path from 'path';
import sanitize from 'sanitize-html';
import { Readable } from 'stream';
import { DataSource } from 'typeorm';
import util from 'util';
import { v4 } from 'uuid';
import { ZipFile } from 'yazl';

import { ItemSettings, ItemType, ItemTypeUnion, getMimetype } from '@graasp/sdk';

import { BaseLogger } from '../../../../logger';
import { Repositories, buildRepositories } from '../../../../utils/repositories';
import { UploadEmptyFileError } from '../../../file/utils/errors';
import { Actor, Member } from '../../../member/entities/member';
import { Item, isItemType } from '../../entities/Item';
import { ItemService } from '../../service';
import { EtherpadItemService } from '../etherpad/service';
import FileItemService from '../file/service';
import { H5PService } from '../html/h5p/service';
import {
  DESCRIPTION_EXTENSION,
  GRAASP_DOCUMENT_EXTENSION,
  GRAASP_MANIFEST_FILENAME,
  HTML_EXTENSION,
  LINK_EXTENSION,
  TXT_EXTENSION,
  URL_PREFIX,
} from './constants';
import { UnexpectedExportError } from './errors';
import { buildTextContent, getFilenameFromItem } from './utils';

export type GraaspExportItem = {
  id: string;
  name: string;
  type: ItemTypeUnion;
  description: string | null;
  settings: ItemSettings;
  thumbnailFilename?: string;
  children?: GraaspExportItem[];
  mimetype?: string;
};

const magic = new Magic(MAGIC_MIME_TYPE);
const asyncDetectFile = util.promisify(magic.detectFile.bind(magic));

export class ImportExportService {
  private readonly fileItemService: FileItemService;
  private readonly h5pService: H5PService;
  private readonly itemService: ItemService;
  private readonly etherpadService: EtherpadItemService;
  private readonly db: DataSource;
  private readonly log: BaseLogger;

  constructor(
    db: DataSource,
    fileItemService: FileItemService,
    itemService: ItemService,
    h5pService: H5PService,
    etherpadService: EtherpadItemService,
    log: BaseLogger,
  ) {
    this.db = db;
    this.fileItemService = fileItemService;
    this.h5pService = h5pService;
    this.itemService = itemService;
    this.etherpadService = etherpadService;
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
   * @param {Repositories} repositories
   * @param {any} options.filename filename of the file to import
   * @returns {any}
   */
  private async _saveItemFromFilename(
    actor: Member,
    repositories: Repositories,
    options: {
      filename: string;
      folderPath: string;
      parent?: Item;
    },
  ): Promise<Item | null> {
    const { filename, folderPath, parent } = options;

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
      return this.itemService.post(actor, repositories, {
        item: {
          description,
          name: filename,
          type: ItemType.FOLDER,
          extra: { [ItemType.FOLDER]: {} },
        },
        parentId: parent?.id,
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
        const type = linkType.includes('1') ? ItemType.APP : ItemType.LINK;
        if (type === ItemType.APP) {
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
          return this.itemService.post(actor, repositories, {
            item: newItem,
            parentId: parent?.id,
          });
        } else if (type === ItemType.LINK) {
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
          return this.itemService.post(actor, repositories, {
            item: newItem,
            parentId: parent?.id,
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
          type: ItemType.DOCUMENT,
          extra: {
            [ItemType.DOCUMENT]: {
              content: sanitize(content),
            },
          },
        };
        return this.itemService.post(actor, repositories, { item: newItem, parentId: parent?.id });
      }

      // normal files
      default: {
        const mimetype = await asyncDetectFile(filepath);
        // upload file
        const file = fs.createReadStream(filepath);
        const item = await this.fileItemService.upload(actor, repositories, {
          filename,
          mimetype,
          description,
          stream: file,
          parentId: parent?.id,
        });

        return item;
      }
    }
  }

  async fetchItemData(
    actor,
    repositories,
    item,
  ): Promise<{ name: string; stream: NodeJS.ReadableStream; mimetype: string }> {
    switch (true) {
      case isItemType(item, ItemType.LOCAL_FILE) || isItemType(item, ItemType.S3_FILE): {
        const mimetype = getMimetype(item.extra) || 'application/octet-stream';
        const url = await this.fileItemService.getUrl(actor, repositories, {
          itemId: item.id,
        });
        const res = await fetch(url);
        const filename = getFilenameFromItem(item);
        return {
          name: filename,
          mimetype,
          stream: res.body,
        };
      }
      case isItemType(item, ItemType.H5P): {
        const h5pUrl = await this.h5pService.getUrl(item);
        const res = await fetch(h5pUrl);

        const filename = getFilenameFromItem(item);
        return { mimetype: 'application/octet-stream', name: filename, stream: res.body };
      }
      case isItemType(item, ItemType.DOCUMENT): {
        return {
          stream: Readable.from([item.extra.document?.content]),
          name: getFilenameFromItem(item),
          mimetype: item.extra.document.isRaw ? 'text/html' : 'text/plain',
        };
      }
      case isItemType(item, ItemType.LINK): {
        return {
          stream: Readable.from(buildTextContent(item.extra.embeddedLink?.url, ItemType.LINK)),
          name: getFilenameFromItem(item),
          mimetype: 'text/plain',
        };
      }
      case isItemType(item, ItemType.APP): {
        return {
          stream: Readable.from(buildTextContent(item.extra.app?.url, ItemType.APP)),
          name: getFilenameFromItem(item),
          mimetype: 'text/plain',
        };
      }
      case isItemType(item, ItemType.ETHERPAD): {
        return {
          stream: Readable.from(
            await this.etherpadService.getEtherpadContentFromItem(actor, item.id),
          ),
          name: getFilenameFromItem(item),
          mimetype: 'text/html',
        };
      }
    }
    throw new Error(`cannot fetch data for item ${item.id}`);
  }

  /**
   * Add item in archive, recursively add children in folder
   * @param actor
   * @param repositories
   * @param args
   */
  private async _addItemToZip(
    actor: Actor,
    repositories: Repositories,
    args: {
      item: Item;
      archiveRootPath: string;
      archive: ZipFile;
    },
  ) {
    const { item, archiveRootPath, archive } = args;

    // save description in file
    if (item.description) {
      archive.addBuffer(
        Buffer.from(item.description),
        path.join(archiveRootPath, `${item.name}${DESCRIPTION_EXTENSION}`),
      );
    }

    if (isItemType(item, ItemType.FOLDER)) {
      // append description
      const folderPath = path.join(archiveRootPath, item.name);
      const children = await this.itemService.getChildren(actor, repositories, item.id);
      const result = await Promise.all(
        children.map((child) =>
          this._addItemToZip(actor, repositories, {
            item: child,
            archiveRootPath: folderPath,
            archive,
          }),
        ),
      );
      // add empty folder
      if (!result.length) {
        return archive.addEmptyDirectory(folderPath);
      }
      return;
    }

    // save single item
    const { stream, name } = await this.fetchItemData(actor, repositories, item);
    return archive.addReadStream(stream, path.join(archiveRootPath, name));
  }

  /**
   * Recursively add items to the Graasp export file.
   * @param args item - the item to add
   *             archive - reference to the zip file to which the files will be written
   *             itemManifest - reference to the item manifest list
   * @returns A full manifest promise for the given item
   */
  private async addItemToGraaspExport(
    actor: Actor,
    repositories: Repositories,
    args: {
      item: Item;
      archive: ZipFile;
      itemManifest: GraaspExportItem[];
    },
  ) {
    const { item, archive, itemManifest } = args;

    // assign the uuid to the exported items
    const exportItemId = v4();
    const itemPath = path.join(path.dirname('./'), exportItemId);

    // ignore the shortcuts
    if (isItemType(item, ItemType.SHORTCUT)) {
      return itemManifest;
    }

    // treat folder items recursively
    const childrenManifest: GraaspExportItem[] = [];
    if (isItemType(item, ItemType.FOLDER)) {
      const childrenItems = await this.itemService.getChildren(actor, repositories, item.id, {
        ordered: true,
      });
      for (const child of childrenItems) {
        await this.addItemToGraaspExport(actor, repositories, {
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
        children: childrenManifest,
      });
      return itemManifest;
    }

    // treat single items
    const { stream, name, mimetype } = await this.fetchItemData(actor, repositories, item);

    itemManifest.push({
      id: exportItemId,
      name,
      description: item.description,
      type: item.type,
      settings: item.settings,
      mimetype,
    });
    archive.addReadStream(stream, itemPath);
    return itemManifest;
  }

  /**
   * Export the items recursively
   * @param item The root item
   * @returns A zip file promise
   */
  async exportRaw(actor: Actor, repositories: Repositories, item: Item) {
    // init archive
    const archive = new ZipFile();
    archive.outputStream.on('error', function (err) {
      throw new UnexpectedExportError(err);
    });
    // path used to index files in archive
    const rootPath = path.dirname('./');

    // import items in zip recursively
    await this._addItemToZip(actor, repositories, {
      item,
      archiveRootPath: rootPath,
      archive,
    }).catch((error) => {
      throw new UnexpectedExportError(error);
    });

    archive.end();
    return archive;
  }

  /**
   * Export the items recursively in the Graasp export format
   * @param item The root item
   * @returns A zip file promise
   */
  async exportGraasp(actor: Actor, repositories: Repositories, item: Item) {
    // init archive
    const archive = new ZipFile();
    archive.outputStream.on('error', function (err) {
      throw new UnexpectedExportError(err);
    });
    // path used to index files in archive
    const rootPath = path.dirname('./');

    const manifest = await this.addItemToGraaspExport(actor, repositories, {
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
   * Util recursive function that create graasp item given folder content
   * @param actor
   * @param repositories
   * @param options.parent parent item might be saved in
   * @param options.folderPath current path in archive of the parent
   */
  async _import(
    actor: Member,
    repositories: Repositories,
    { parent, folderPath }: { parent?: Item; folderPath: string },
  ) {
    const filenames = fs.readdirSync(folderPath);

    const items: Item[] = [];
    for (const filename of filenames) {
      // import item from file excluding descriptions
      // descriptions are handled alongside the corresponding file
      if (!filename.endsWith(DESCRIPTION_EXTENSION)) {
        try {
          // transaction is necessary since we are adding data
          // we don't add it at the very top to allow partial zip to be updated
          await this.db.transaction(async (manager) => {
            const item = await this._saveItemFromFilename(actor, buildRepositories(manager), {
              filename,
              folderPath,
              parent,
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
      const { type, name } = newItem;
      if (type === ItemType.FOLDER) {
        await this._import(actor, repositories, {
          folderPath: path.join(folderPath, name),
          parent: newItem,
        });
      }
    }
  }

  async import(
    actor: Member,
    repositories: Repositories,
    {
      folderPath,
      targetFolder,
      parentId,
    }: { folderPath: string; targetFolder: string; parentId?: string },
  ): Promise<void> {
    let parent: Item | undefined;
    if (parentId) {
      // check item permission
      parent = await this.itemService.get(actor, repositories, parentId);
    }

    await this._import(actor, repositories, { parent, folderPath });

    // delete zip and content
    fs.rmSync(targetFolder, { recursive: true });
  }
}
