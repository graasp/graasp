import fs, { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import mimetics from 'mimetics';
import fetch from 'node-fetch';
import path from 'path';
import sanitize from 'sanitize-html';
import { Readable } from 'stream';
import { ZipFile } from 'yazl';

import { FastifyReply } from 'fastify';

import { ItemType, getMimetype } from '@graasp/sdk';

import { DBConnection } from '../../../../drizzle/db';
import { Item } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import { MaybeUser, MinimalMember } from '../../../../types';
import { UploadEmptyFileError } from '../../../file/utils/errors';
import { isItemType } from '../../discrimination';
import { ItemService } from '../../service';
import { EtherpadItemService } from '../etherpad/service';
import FileItemService from '../file/service';
import { H5PService } from '../html/h5p/service';
import {
  DESCRIPTION_EXTENSION,
  GRAASP_DOCUMENT_EXTENSION,
  HTML_EXTENSION,
  LINK_EXTENSION,
  TXT_EXTENSION,
  URL_PREFIX,
} from './constants';
import { UnexpectedExportError } from './errors';
import { buildTextContent, getFilenameFromItem } from './utils';

export class ImportExportService {
  private readonly fileItemService: FileItemService;
  private readonly h5pService: H5PService;
  private readonly itemService: ItemService;
  private readonly etherpadService: EtherpadItemService;
  private readonly log: BaseLogger;
  private readonly mimetics: typeof mimetics;

  constructor(
    fileItemService: FileItemService,
    itemService: ItemService,
    h5pService: H5PService,
    etherpadService: EtherpadItemService,
    log: BaseLogger,
  ) {
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
   * @param {any} options.filename filename of the file to import
   * @returns {any}
   */
  private async _saveItemFromFilename(
    db: DBConnection,
    actor: MinimalMember,
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
      return this.itemService.post(db, actor, {
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
          return this.itemService.post(db, actor, {
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
          return this.itemService.post(db, actor, {
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
        return this.itemService.post(db, actor, {
          item: newItem,
          parentId: parent?.id,
        });
      }

      // normal files
      default: {
        // TODO: replace by file-type library once we are in ESM
        const fileTypeAnalysis = await mimetics.parseAsync(fs.readFileSync(filepath));
        const mimetype = fileTypeAnalysis?.mime ?? 'text/plain';

        // upload file
        const file = fs.createReadStream(filepath);
        const item = await this.fileItemService.upload(db, actor, {
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
    db: DBConnection,
    actor,
    item,
  ): Promise<{
    name: string;
    stream: NodeJS.ReadableStream;
    mimetype: string;
  }> {
    switch (true) {
      case isItemType(item, ItemType.LOCAL_FILE) || isItemType(item, ItemType.S3_FILE): {
        const mimetype = getMimetype(item.extra) || 'application/octet-stream';
        const url = await this.fileItemService.getUrl(db, actor, {
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
        return {
          mimetype: 'application/octet-stream',
          name: filename,
          stream: res.body,
        };
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
            await this.etherpadService.getEtherpadContentFromItem(db, actor, item.id),
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
   * @param args
   */
  private async _addItemToZip(
    db: DBConnection,
    actor: MaybeUser,
    args: {
      reply;
      item: Item;
      archiveRootPath: string;
      archive: ZipFile;
    },
    logger: BaseLogger,
  ) {
    const { item, archiveRootPath, archive, reply } = args;

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
      const children = await this.itemService.getChildren(db, actor, item.id);
      const result = await Promise.all(
        children.map((child) =>
          this._addItemToZip(
            db,
            actor,
            {
              item: child,
              archiveRootPath: folderPath,
              archive,
              reply,
            },
            logger,
          ),
        ),
      );
      // add empty folder
      if (!result.length) {
        return archive.addEmptyDirectory(folderPath);
      }
      return;
    }

    // save single item
    const { stream, name } = await this.fetchItemData(db, actor, item);
    return archive.addReadStream(stream, path.join(archiveRootPath, name));
  }

  async export(
    db: DBConnection,
    actor: MaybeUser,
    { item, reply }: { item: Item; reply: FastifyReply },
    logger: BaseLogger,
  ) {
    // init archive
    const archive = new ZipFile();
    archive.outputStream.on('error', function (err) {
      throw new UnexpectedExportError(err);
    });

    // path used to index files in archive
    const rootPath = path.dirname('./');

    // import items in zip recursively
    await this._addItemToZip(
      db,
      actor,
      {
        item,
        reply,
        archiveRootPath: rootPath,
        archive,
      },
      logger,
    ).catch((error) => {
      throw new UnexpectedExportError(error);
    });

    archive.end();
    return archive;
  }

  /**
   * Util recursive function that create graasp item given folder content
   * @param actor
   * @param options.parent parent item might be saved in
   * @param options.folderPath current path in archive of the parent
   */
  async _import(
    db: DBConnection,
    actor: MinimalMember,
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
          await db.transaction(async (tx) => {
            const item = await this._saveItemFromFilename(tx, actor, {
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
        await this._import(db, actor, {
          folderPath: path.join(folderPath, name),
          parent: newItem,
        });
      }
    }
  }

  async import(
    db: DBConnection,
    actor: MinimalMember,
    {
      folderPath,
      targetFolder,
      parentId,
    }: { folderPath: string; targetFolder: string; parentId?: string },
  ): Promise<void> {
    let parent: Item | undefined;
    if (parentId) {
      // check item permission
      parent = await this.itemService.get(db, actor, parentId);
    }

    await this._import(db, actor, { parent, folderPath });

    // delete zip and content
    fs.rmSync(targetFolder, { recursive: true });
  }
}
