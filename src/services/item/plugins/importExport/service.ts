import archiver, { Archiver } from 'archiver';
import fs, { existsSync } from 'fs';
import { mkdir, readFile } from 'fs/promises';
import mime from 'mime-types';
import mmm from 'mmmagic';
import path from 'path';
import util from 'util';

import { FastifyBaseLogger, FastifyReply } from 'fastify';

import {
  AppItemExtraProperties,
  DocumentItemExtraProperties,
  EmbeddedLinkItemExtraProperties,
  H5PItemType,
  ItemType,
  LocalFileItemExtra,
  S3FileItemExtra,
  UUID,
} from '@graasp/sdk';

import { TMP_FOLDER } from '../../../../utils/config';
import { Repositories } from '../../../../utils/repositories';
import { UploadEmptyFileError } from '../../../file/utils/errors';
import { Actor, Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';
import ItemService from '../../service';
import FileItemService from '../file/service';
import { H5PService } from '../h5p/service';
import {
  DESCRIPTION_EXTENSION,
  GRAASP_DOCUMENT_EXTENSION,
  LINK_EXTENSION,
  TMP_EXPORT_ZIP_FOLDER_PATH,
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
  fileStorage: string;

  constructor(fileItemService: FileItemService, itemService: ItemService, h5pService: H5PService) {
    this.fileItemService = fileItemService;
    this.h5pService = h5pService;
    this.itemService = itemService;
    // save temp files
    this.fileStorage = path.join(TMP_FOLDER, 'export-zip');
  }

  private async _getDescriptionForFilepath(filepath: string): Promise<string> {
    const descriptionFilePath = filepath + DESCRIPTION_EXTENSION;
    if (existsSync(descriptionFilePath)) {
      // get folder description (inside folder) if it exists
      return readFile(descriptionFilePath, {
        encoding: 'utf8',
        flag: 'r',
      });
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

      return this.itemService.post(actor, repositories, {
        item: { description, name: filename, type: ItemType.FOLDER },
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

    // links and apps
    if (filename.endsWith(LINK_EXTENSION)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_source, link, linkType] = content.split('\n');

      // get url from content
      const url = link.slice(URL_PREFIX.length);

      // get if app in content -> url is either a link or an app
      const type = linkType.includes('1') ? ItemType.APP : ItemType.LINK;
      if (type === ItemType.APP) {
        const newItem = {
          name: filename.slice(0, -LINK_EXTENSION.length),
          description,
          type,
          extra: {
            [type]: {
              url,
            },
          },
        } as Partial<Item>;
        return this.itemService.post(actor, repositories, { item: newItem, parentId: parent?.id });
      } else if (type === ItemType.LINK) {
        const newItem = {
          name: filename.slice(0, -LINK_EXTENSION.length),
          description,
          type,
          extra: {
            [type]: {
              url,
            },
          },
        } as Partial<Item>;
        return this.itemService.post(actor, repositories, { item: newItem, parentId: parent?.id });
      } else {
        throw new Error(`${type} is not handled`);
      }
    }
    // documents
    else if (filename.endsWith(GRAASP_DOCUMENT_EXTENSION)) {
      const newItem = {
        // remove .graasp from name
        name: filename.slice(0, -GRAASP_DOCUMENT_EXTENSION.length),
        description,
        type: ItemType.DOCUMENT,
        extra: {
          [ItemType.DOCUMENT]: {
            // not sure
            content: content,
          },
        },
      } as Partial<Item>;
      return this.itemService.post(actor, repositories, { item: newItem, parentId: parent?.id });
    }
    // normal files
    else {
      const mimetype = await asyncDetectFile(filepath);
      // upload file
      const file = fs.createReadStream(filepath);
      const item = await this.fileItemService._upload(actor, repositories, {
        filename,
        mimetype,
        filepath,
        description,
        stream: file,
        parentId: parent?.id,
      });

      return item;
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
      archive: Archiver;
      fileStorage: string;
    },
  ) {
    const { item, archiveRootPath, archive, reply, fileStorage } = args;

    // save description in file
    if (item.description) {
      archive.append(item.description, {
        name: path.join(archiveRootPath, `${item.name}${DESCRIPTION_EXTENSION}`),
      });
    }

    switch (item.type) {
      case ItemType.S3_FILE:
      case ItemType.LOCAL_FILE: {
        // TODO: refactor
        const { mimetype } =
          (item.extra[ItemType.S3_FILE] as S3FileItemExtra) ||
          (item.extra[ItemType.LOCAL_FILE] as LocalFileItemExtra);
        const fileStream = await this.fileItemService.download(actor, repositories, {
          fileStorage,
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
        archive.append(fileStream, {
          name: path.join(archiveRootPath, filename),
        });

        break;
      }
      case ItemType.H5P: {
        const fileStream = await this.h5pService.downloadH5P(
          item as H5PItemType,
          actor,
          fileStorage,
        );

        archive.append(fileStream, {
          name: path.join(archiveRootPath, item.name),
        });

        break;
      }
      case ItemType.DOCUMENT:
        archive.append((item.extra.document as DocumentItemExtraProperties)?.content, {
          name: path.join(archiveRootPath, `${item.name}${GRAASP_DOCUMENT_EXTENSION}`),
        });
        break;
      case ItemType.LINK:
        archive.append(
          buildTextContent(
            (item.extra.embeddedLink as EmbeddedLinkItemExtraProperties)?.url,
            ItemType.LINK,
          ),
          {
            name: path.join(archiveRootPath, `${item.name}${LINK_EXTENSION}`),
          },
        );
        break;
      case ItemType.APP:
        archive.append(
          buildTextContent((item.extra.app as AppItemExtraProperties)?.url, ItemType.APP),
          {
            name: path.join(archiveRootPath, `${item.name}${LINK_EXTENSION}`),
          },
        );
        break;
      case ItemType.FOLDER: {
        // append description
        const folderPath = path.join(archiveRootPath, item.name);
        const children = await repositories.itemRepository.getChildren(item);
        await Promise.all(
          children.map((child) =>
            this._addItemToZip(actor, repositories, {
              item: child,
              archiveRootPath: folderPath,
              archive,
              reply,
              fileStorage,
            }),
          ),
        );
        break;
      }
    }
  }

  async export(
    actor: Actor,
    repositories: Repositories,
    { itemId, reply }: { itemId: UUID; reply: FastifyReply },
  ) {
    // check item and permission
    const item = await this.itemService.get(actor, repositories, itemId);

    // init archive
    const archive = archiver.create('zip', { store: true });
    archive.on('warning', function (err) {
      if (err.code === 'ENOENT') {
        // log.debug(err);
      } else {
        throw err;
      }
    });
    archive.on('error', function (err) {
      throw err;
    });

    // path to save files temporarly and save archive
    const fileStorage = path.join(TMP_EXPORT_ZIP_FOLDER_PATH, item.id);
    await mkdir(fileStorage, { recursive: true });
    const zipPath = path.join(fileStorage, item.id + '.zip');
    const zipStream = fs.createWriteStream(zipPath);
    archive.pipe(zipStream);

    // path used to index files in archive
    const rootPath = path.dirname('./');

    // import items in zip recursively
    await this._addItemToZip(actor, repositories, {
      item,
      reply,
      archiveRootPath: rootPath,
      archive,
      fileStorage,
    }).catch((error) => {
      throw new UnexpectedExportError(error);
    });

    // wait for zip to be completely created and send it
    return new Promise((resolve, reject) => {
      zipStream.on('error', (e) => {
        console.error(e);
        reject(e);
      });

      zipStream.on('close', () => {
        // set reply headers depending zip file and return file
        const buffer = fs.readFileSync(zipPath);
        try {
          reply.raw.setHeader(
            'Content-Disposition',
            `filename="${encodeURIComponent(item.name)}.zip"`,
          );
        } catch (e) {
          // TODO: send sentry error
          console.error(e);
          reply.raw.setHeader('Content-Disposition', 'filename="download.zip"');
        }
        reply.raw.setHeader('Content-Length', Buffer.byteLength(buffer));
        reply.type('application/zip');

        // delete tmp files after endpoint responded
        if (fs.existsSync(fileStorage)) {
          fs.rmSync(fileStorage, { recursive: true });
        } else {
          //  log?.error(`${fileStorage} was not found, and was not deleted`);
        }

        resolve(buffer);
      });

      archive.finalize();
    });
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
          const item = await this._saveItemFromFilename(actor, repositories, {
            filename,
            folderPath,
            parent,
          });
          if (item) {
            items.push(item);
          }
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
