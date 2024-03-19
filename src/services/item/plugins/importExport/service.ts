import fs, { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import mime from 'mime-types';
import mmm from 'mmmagic';
import fetch from 'node-fetch';
import path from 'path';
import sanitize from 'sanitize-html';
import { DataSource } from 'typeorm';
import util from 'util';
import yazl, { ZipFile } from 'yazl';

import { FastifyBaseLogger, FastifyReply } from 'fastify';

import { ItemType } from '@graasp/sdk';

import { Repositories, buildRepositories } from '../../../../utils/repositories';
import { UploadEmptyFileError } from '../../../file/utils/errors';
import { Actor, Member } from '../../../member/entities/member';
import { Item, isItemType } from '../../entities/Item';
import ItemService from '../../service';
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
import { buildTextContent } from './utils';

const magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);
const asyncDetectFile = util.promisify(magic.detectFile.bind(magic));

export class ImportExportService {
  fileItemService: FileItemService;
  h5pService: H5PService;
  itemService: ItemService;
  db: DataSource;
  logger: FastifyBaseLogger;

  constructor(
    db: DataSource,
    fileItemService: FileItemService,
    itemService: ItemService,
    h5pService: H5PService,
    log: FastifyBaseLogger,
  ) {
    this.db = db;
    this.fileItemService = fileItemService;
    this.h5pService = h5pService;
    this.itemService = itemService;
    this.logger = log;
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
    log: FastifyBaseLogger,
  ): Promise<Item | null> {
    const { filename, folderPath, parent } = options;

    log.debug(`handling '${filename}'`);

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

      log.debug(`create folder from '${filename}'`);
      return this.itemService.post(
        actor,
        repositories,
        {
          item: {
            description,
            name: filename,
            type: ItemType.FOLDER,
            extra: { [ItemType.FOLDER]: { childrenOrder: [] } },
          },
          parentId: parent?.id,
        },
        log,
      );
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
          return this.itemService.post(
            actor,
            repositories,
            { item: newItem, parentId: parent?.id },
            log,
          );
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
          return this.itemService.post(
            actor,
            repositories,
            { item: newItem, parentId: parent?.id },
            log,
          );
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
        return this.itemService.post(
          actor,
          repositories,
          { item: newItem, parentId: parent?.id },
          log,
        );
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
      reply;
      item: Item;
      archiveRootPath: string;
      archive: ZipFile;
    },
  ) {
    const { item, archiveRootPath, archive, reply } = args;

    // save description in file
    if (item.description) {
      archive.addBuffer(
        Buffer.from(item.description),
        path.join(archiveRootPath, `${item.name}${DESCRIPTION_EXTENSION}`),
      );
    }

    if (isItemType(item, ItemType.LOCAL_FILE) || isItemType(item, ItemType.S3_FILE)) {
      // TODO: refactor
      const s3Extra = isItemType(item, ItemType.S3_FILE) ? item.extra.s3File : undefined;
      const localFileExtra = isItemType(item, ItemType.LOCAL_FILE) ? item.extra.file : undefined;
      const { mimetype } = { ...s3Extra, ...localFileExtra };
      const url = await this.fileItemService.getUrl(actor, repositories, {
        itemId: item.id,
      });

      // build filename with extension if does not exist
      let ext = path.extname(item.name);
      if (!ext) {
        // only add a dot in case of building file name with mimetype, otherwise there will be two dots in file name
        ext = `.${mime.extension(mimetype)}`;
      }
      const filename = `${path.basename(item.name, ext)}${ext}`;

      // add file in archive
      const res = await fetch(url);
      archive.addReadStream(res.body, path.join(archiveRootPath, filename));
    }
    if (isItemType(item, ItemType.H5P)) {
      const h5pUrl = await this.h5pService.getUrl(item, actor);
      const res = await fetch(h5pUrl);

      archive.addReadStream(res.body, path.join(archiveRootPath, item.name));
    }

    if (isItemType(item, ItemType.DOCUMENT)) {
      archive.addBuffer(
        Buffer.from(item.extra.document?.content, 'utf-8'),
        path.join(archiveRootPath, `${item.name}${GRAASP_DOCUMENT_EXTENSION}`),
      );
    }
    if (isItemType(item, ItemType.LINK)) {
      archive.addBuffer(
        Buffer.from(buildTextContent(item.extra.embeddedLink?.url, ItemType.LINK)),
        path.join(archiveRootPath, `${item.name}${LINK_EXTENSION}`),
      );
    }
    if (isItemType(item, ItemType.APP)) {
      archive.addBuffer(
        Buffer.from(buildTextContent(item.extra.app?.url, ItemType.APP)),
        path.join(archiveRootPath, `${item.name}${LINK_EXTENSION}`),
      );
    }
    if (isItemType(item, ItemType.FOLDER)) {
      // append description
      const folderPath = path.join(archiveRootPath, item.name);
      const children = await repositories.itemRepository.getChildren(item);
      const result = await Promise.all(
        children.map((child) =>
          this._addItemToZip(actor, repositories, {
            item: child,
            archiveRootPath: folderPath,
            archive,
            reply,
          }),
        ),
      );
      // add empty folder
      if (!result.length) {
        archive.addEmptyDirectory(folderPath);
      }
    }
  }

  async export(
    actor: Actor,
    repositories: Repositories,
    { item, reply }: { item: Item; reply: FastifyReply },
  ) {
    // init archive
    const archive = new yazl.ZipFile();
    archive.outputStream.on('error', function (err) {
      throw new UnexpectedExportError(err);
    });

    // path used to index files in archive
    const rootPath = path.dirname('./');

    // import items in zip recursively
    await this._addItemToZip(actor, repositories, {
      item,
      reply,
      archiveRootPath: rootPath,
      archive,
    }).catch((error) => {
      throw new UnexpectedExportError(error);
    });

    archive.end();
    return archive;
  }

  /**
   * Util recursive function that create graasp item given folder content
   * @param actor
   * @param repositories
   * @param options.parent parent item might be saved in
   * @param options.folderPath current path in archive of the parent
   * @param log logger
   */
  async _import(
    actor: Member,
    repositories: Repositories,
    { parent, folderPath }: { parent?: Item; folderPath: string },
    log: FastifyBaseLogger,
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
            const item = await this._saveItemFromFilename(
              actor,
              buildRepositories(manager),
              {
                filename,
                folderPath,
                parent,
              },
              log,
            );
            if (item) {
              items.push(item);
            }
          });
        } catch (e) {
          if (e instanceof UploadEmptyFileError) {
            // ignore empty files
            log.debug(`ignore ${filename} because it is empty`);
          } else {
            // improvement: return a list of failed imports
            log.error(e);
            throw e;
          }
        }
      }
    }

    // recursively create children in folders
    for (const newItem of items) {
      const { type, name } = newItem;
      if (type === ItemType.FOLDER) {
        await this._import(
          actor,
          repositories,
          {
            folderPath: path.join(folderPath, name),
            parent: newItem,
          },
          log,
        );
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
    log: FastifyBaseLogger,
  ): Promise<void> {
    let parent;
    if (parentId) {
      // check item permission
      parent = await this.itemService.get(actor, repositories, parentId);
    }

    await this._import(actor, repositories, { parent, folderPath }, log);

    // delete zip and content
    fs.rmSync(targetFolder, { recursive: true });
  }
}
