import * as fs from 'fs';
import path from 'path';
import { fromPath as convertPDFtoImageFromPath } from 'pdf2pic';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { withFile as withTmpFile } from 'tmp-promise';
import { delay, inject, singleton } from 'tsyringe';

import {
  FileItemProperties,
  ItemType,
  MAX_ITEM_NAME_LENGTH,
  MimeTypes,
  PermissionLevel,
  getFileExtension,
} from '@graasp/sdk';

import { type DBConnection } from '../../../../drizzle/db';
import { type ItemRaw } from '../../../../drizzle/types';
import { BaseLogger } from '../../../../logger';
import { MaybeUser, MinimalMember } from '../../../../types';
import { asDefined } from '../../../../utils/assertions';
import { AuthorizationService } from '../../../authorization';
import FileService from '../../../file/file.service';
import { UploadEmptyFileError } from '../../../file/utils/errors';
import { ItemMembershipRepository } from '../../../itemMembership/membership.repository';
import { StorageService } from '../../../member/plugins/storage/memberStorage.service';
import { ThumbnailService } from '../../../thumbnail/thumbnail.service';
import { randomHexOf4 } from '../../../utils';
import { ItemWrapperService } from '../../ItemWrapper';
import { BasicItemService } from '../../basic.service';
import { WrongItemTypeError } from '../../errors';
import { ItemRepository } from '../../item.repository';
import { ItemService } from '../../item.service';
import { readPdfContent } from '../../utils';
import { ItemGeolocationRepository } from '../geolocation/itemGeolocation.repository';
import { ItemVisibilityRepository } from '../itemVisibility/itemVisibility.repository';
import { ItemPublishedRepository } from '../publication/published/itemPublished.repository';
import { MeiliSearchWrapper } from '../publication/published/plugins/search/meilisearch';
import { RecycledBinService } from '../recycled/recycled.service';
import { ItemThumbnailService } from '../thumbnail/itemThumbnail.service';

@singleton()
class FileItemService extends ItemService {
  private readonly fileService: FileService;
  private readonly storageService: StorageService;

  constructor(
    thumbnailService: ThumbnailService,
    fileService: FileService,
    storageService: StorageService,
    meilisearchWrapper: MeiliSearchWrapper,
    @inject(delay(() => ItemThumbnailService))
    itemThumbnailService: ItemThumbnailService,
    authorizationService: AuthorizationService,
    itemRepository: ItemRepository,
    itemMembershipRepository: ItemMembershipRepository,
    itemPublishedRepository: ItemPublishedRepository,
    itemGeolocationRepository: ItemGeolocationRepository,
    itemWrapperService: ItemWrapperService,
    itemVisibilityRepository: ItemVisibilityRepository,
    basicItemService: BasicItemService,
    recycledBinService: RecycledBinService,
    log: BaseLogger,
  ) {
    super(
      thumbnailService,
      itemThumbnailService,
      itemMembershipRepository,
      meilisearchWrapper,
      itemRepository,
      itemPublishedRepository,
      itemGeolocationRepository,
      authorizationService,
      itemWrapperService,
      itemVisibilityRepository,
      basicItemService,
      recycledBinService,
      log,
    );
    this.fileService = fileService;
    this.storageService = storageService;
  }

  public buildFilePath(extension: string = '') {
    // TODO: CHANGE ??
    const filepath = `${randomHexOf4()}/${randomHexOf4()}/${randomHexOf4()}-${Date.now()}${extension}`;
    return path.join('files', filepath);
  }

  async upload(
    dbConnection: DBConnection,
    actor: MinimalMember,
    {
      description,
      parentId,
      filename,
      mimetype,
      stream,
      previousItemId,
    }: {
      description?: string;
      parentId?: string;
      filename: string;
      mimetype: string;
      stream: Readable;
      previousItemId?: ItemRaw['id'];
    },
  ) {
    const filepath = this.buildFilePath(getFileExtension(filename)); // parentId, filename

    // check member storage limit
    await this.storageService.checkRemainingStorage(dbConnection, actor);

    return await withTmpFile(async ({ path }) => {
      // Write uploaded file to a temporary file
      await pipeline(stream, fs.createWriteStream(path));

      // Content to be indexed for search
      let content = '';
      if (MimeTypes.isPdf(mimetype)) {
        content = await readPdfContent(path);
      }

      // Upload to storage
      await this.fileService.upload(actor, {
        file: fs.createReadStream(path),
        filepath,
        mimetype,
      });

      const size = await this.fileService.getFileSize(actor, filepath);

      // throw for empty files
      if (!size) {
        await this.fileService.delete(filepath);
        throw new UploadEmptyFileError();
      }

      // create item from file properties
      const name = filename.substring(0, MAX_ITEM_NAME_LENGTH);
      const fileProperties: FileItemProperties = {
        name: filename,
        path: filepath,
        mimetype,
        size,
        content,
      };
      const item = {
        name,
        description,
        type: this.fileService.fileType,
        extra: {
          // this is needed because if we directly use `this.fileService.type` then TS widens the type to `string` which we do not want
          ...(this.fileService.fileType === ItemType.LOCAL_FILE
            ? { [ItemType.LOCAL_FILE]: fileProperties }
            : { [ItemType.S3_FILE]: fileProperties }),
        },
        creator: actor,
      };

      const newItem = await super.post(dbConnection, actor, {
        item,
        parentId,
        previousItemId,
      });

      // add thumbnails if image or pdf
      // allow failures
      try {
        if (MimeTypes.isImage(mimetype)) {
          await this.itemThumbnailService.upload(
            dbConnection,
            actor,
            newItem.id,
            fs.createReadStream(path),
          );
        } else if (MimeTypes.isPdf(mimetype)) {
          // Convert first page of PDF to image buffer and upload as thumbnail
          const outputImg = await convertPDFtoImageFromPath(path)(1, { responseType: 'buffer' });
          const buffer = asDefined(outputImg.buffer);
          await this.itemThumbnailService.upload(
            dbConnection,
            actor,
            newItem.id,
            Readable.from(buffer),
          );
        }
      } catch (e) {
        console.error(e);
      }

      // retrieve item again since hasThumbnail might have changed
      return await this.itemRepository.getOneOrThrow(dbConnection, newItem.id);
    });
  }

  async getFile(
    dbConnection: DBConnection,
    actor: MaybeUser,
    {
      itemId,
    }: {
      itemId: string;
    },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);
    await this.authorizationService.validatePermission(
      dbConnection,
      PermissionLevel.Read,
      actor,
      item,
    );
    const extraData = item.extra[this.fileService.fileType] as FileItemProperties;
    const result = await this.fileService.getFile(actor, {
      id: itemId,
      ...extraData,
    });

    return result;
  }

  async getUrl(
    dbConnection: DBConnection,
    actor: MaybeUser,
    {
      itemId,
    }: {
      itemId: string;
    },
  ) {
    // prehook: get item and input in download call ?
    // check rights
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);
    await this.authorizationService.validatePermission(
      dbConnection,
      PermissionLevel.Read,
      actor,
      item,
    );
    const extraData = item.extra[this.fileService.fileType] as FileItemProperties | undefined;

    const result = await this.fileService.getUrl({
      path: extraData?.path,
    });

    return result;
  }

  async copyFile(dbConnection: DBConnection, member: MinimalMember, { copy }: { original; copy }) {
    const { id, extra } = copy; // full copy with new `id`
    const { path: originalPath, mimetype, name } = extra[this.fileService.fileType];
    const newFilePath = this.buildFilePath(getFileExtension(name));

    const data = {
      newId: id,
      originalPath,
      newFilePath,
      mimetype,
    };

    // check member storage limit in pre copy because all items are pretested

    const filepath = await this.fileService.copy(member, data);

    // update item copy's 'extra'
    if (this.fileService.fileType === ItemType.S3_FILE) {
      await this.itemRepository.updateOne(dbConnection, copy.id, {
        extra: { s3File: { ...extra.s3File, path: filepath } },
      });
    } else {
      await this.itemRepository.updateOne(dbConnection, copy.id, {
        extra: { file: { ...extra.s3File, path: filepath } },
      });
    }
  }

  async update(
    dbConnection: DBConnection,
    member: MinimalMember,
    itemId: ItemRaw['id'],
    body: Partial<Pick<ItemRaw, 'name' | 'description' | 'settings' | 'lang'>>,
  ) {
    const item = await this.itemRepository.getOneOrThrow(dbConnection, itemId);

    // check item is file
    if (!([ItemType.LOCAL_FILE, ItemType.S3_FILE] as ItemRaw['type'][]).includes(item.type)) {
      throw new WrongItemTypeError(item.type);
    }

    await super.patch(dbConnection, member, item.id, body);
  }
}

export default FileItemService;
