import archiver, { Archiver } from 'archiver';
import fs from 'fs';
import { mkdir, readFile } from 'fs/promises';
import mime from 'mime-types';
import mmm from 'mmmagic';
import path from 'path';
import util from 'util';

import { MultipartFile } from '@fastify/multipart';

import {
  AppItemExtraProperties,
  DocumentItemExtraProperties,
  EmbeddedLinkItemExtraProperties,
  ItemType,
  LocalFileItemExtra,
  S3FileItemExtra,
} from '@graasp/sdk';

import { Repositories } from '../../../../utils/repositories';
import { Item } from '../../entities/Item';
import ItemService from '../../service';
import FileItemService from '../file/service';
import {
  DESCRIPTION_EXTENSION,
  GRAASP_DOCUMENT_EXTENSION,
  LINK_EXTENSION,
  TMP_EXPORT_ZIP_FOLDER_PATH,
  URL_PREFIX,
  ZIP_FILE_MIME_TYPES,
} from './constants';
import { FileIsInvalidArchiveError, UnexpectedExportError } from './errors';
import { buildTextContent, handleItemDescription, prepareZip } from './utils';

const magic = new mmm.Magic(mmm.MAGIC_MIME_TYPE);
const asyncDetectFile = util.promisify(magic.detectFile.bind(magic));

export class ImportExportService {
  fileItemService: FileItemService;
  // h5pService;
  itemService: ItemService;

  constructor(
    fileItemService: FileItemService,
    itemService: ItemService,
    // h5pService: H5PService,
  ) {
    this.fileItemService = fileItemService;
    // this.h5pService = h5pService;
    this.itemService = itemService;
  }

  private async _buildItemFromFilename(
    actor,
    repositories: Repositories,
    options: {
      filename: string;
      folderPath: string;
      parentId: string;
      // log: FastifyBaseLogger;
    },
  ): Promise<Partial<Item> | null> {
    const { filename, folderPath, parentId } = options;

    // ignore hidden files such as .DS_STORE
    if (filename.startsWith('.')) {
      return null;
    }

    const filepath = path.join(folderPath, filename);
    const stats = fs.lstatSync(filepath);

    // folder
    if (stats.isDirectory()) {
      // element has no extension -> folder
      return {
        name: filename,
        type: ItemType.FOLDER,
      };
    }

    // string content
    // todo: optimize to avoid reading the file twice in case of upload
    const content = await readFile(filepath, {
      encoding: 'utf8',
      flag: 'r',
    });

    // links and apps
    if (filename.endsWith(LINK_EXTENSION)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [_source, link, linkType] = content.split('\n');

      // get url from content
      const url = link.slice(URL_PREFIX.length);

      // get if app in content -> url is either a link or an app
      const type = linkType.includes('1') ? ItemType.APP : ItemType.LINK;
      if (type === ItemType.APP) {
        return {
          name: filename.slice(0, -LINK_EXTENSION.length),
          type,
          extra: {
            [type]: {
              url,
            },
          },
        } as Partial<Item>;
      } else if (type === ItemType.LINK) {
        return {
          name: filename.slice(0, -LINK_EXTENSION.length),
          type,
          extra: {
            [type]: {
              url,
            },
          },
        } as Partial<Item>;
      } else {
        throw new Error(`${type} is not handled`);
      }
    }
    // documents
    else if (filename.endsWith(GRAASP_DOCUMENT_EXTENSION)) {
      return {
        // remove .graasp from name
        name: filename.slice(0, -GRAASP_DOCUMENT_EXTENSION.length),
        type: ItemType.DOCUMENT,
        extra: {
          [ItemType.DOCUMENT]: {
            // not sure
            content: content,
          },
        },
      };
    }
    // normal files
    else {
      const mimetype = await asyncDetectFile(filepath);

      // upload file
      const [item] = await this.fileItemService.upload(
        actor,
        repositories,
        [{ filename, mimetype, filepath }],
        parentId,
      );

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
    actor,
    repositories: Repositories,
    args: {
      reply;
      item: Item;
      archiveRootPath: string;
      archive: Archiver;
    },
  ) {
    const { item, archiveRootPath, archive, reply } = args;

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
          reply,
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
        // const fileStream = await this.h5pService.download(actor, repositories, item, fileStorage)

        // archive.append(fileStream, {
        //   name: path.join(archiveRootPath, item.name),
        // });

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
        const children = await repositories.itemRepository.getChildren(item );
        await Promise.all(
          children.map((child) =>
            this._addItemToZip(actor, repositories, {
              item: child,
              archiveRootPath: folderPath,
              archive,
              reply,
            }),
          ),
        );
        break;
      }
    }
  }

  async export(actor, repositories: Repositories, { itemId, reply }) {
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
   * @param param2
   */
  async _import(actor, repositories, { parent, folderPath }) {
    const filenames = fs.readdirSync(folderPath);
    const folderName = path.basename(folderPath);

    // we save item in batch for optimization, but also because
    // order and descriptions are saved separately
    const items: Partial<Item>[] = [];

    for (const filename of filenames) {
      const filepath = path.join(folderPath, filename);

      // update items' descriptions
      if (filename.endsWith(DESCRIPTION_EXTENSION)) {
        await handleItemDescription({
          filename,
          filepath,
          folderName,
          items,
          updateParentDescription: (description) =>
            repositories.itemRepository.patch(parent.id, { description }),
        });
      }
      // add new item
      else {
        const item = await this._buildItemFromFilename(actor, repositories, {
          filename,
          folderPath,
          parentId: parent.id,
        });
        // .catch( (e)=> {
        //   if (e instanceof UploadEmptyFileError) {
        //     // ignore empty files
        //   } else {
        //     // improvement: return a list of failed imports
        //     throw e;
        //   }
        // });
        if (!item && item !== null) {
          items.push(item);
        }
      }
    }

    // create the items
    const newItems = await Promise.all(
      items.map(async (item) => repositories.itemRepository.post(item, actor, parent)),
    );

    // recursively create children in folders
    for (const newItem of newItems) {
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
    actor,
    repositories,
    { zipFile, parentId }: { zipFile: MultipartFile; parentId?: string },
  ): Promise<void> {
    // throw if file is not a zip
    if (!ZIP_FILE_MIME_TYPES.includes(zipFile.mimetype)) {
      throw new FileIsInvalidArchiveError(zipFile.mimetype);
    }

    const { folderPath } = await prepareZip(zipFile.file);

    let parent;
    if (parentId) {
      // check item permission
      parent = await this.itemService.get(actor, repositories, parentId);
    }

    await this._import(actor, repositories, { parent, folderPath });

    // delete zip and content
    fs.rmSync(folderPath, { recursive: true });
  }
}
