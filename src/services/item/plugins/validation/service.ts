import { mkdirSync, rmSync } from 'fs';
import mime from 'mime-types';
import path from 'path';

import {
  ItemType,
  ItemValidationProcess,
  ItemValidationReviewStatus,
  ItemValidationStatus,
  LocalFileItemExtra,
  PermissionLevel,
  S3FileItemExtra,
} from '@graasp/sdk';

import { Repositories } from '../../../../util/repositories';
import { validatePermission } from '../../../authorization';
import FileService from '../../../file/service';
import { Item } from '../../entities/Item';
import ItemService from '../../service';
import { IMAGE_FILE_EXTENSIONS } from './constants';
import { ItemValidationGroup } from './entities/ItemValidationGroup';
import {
  InvalidFileItemError,
  ItemValidationError,
  ProcessExecutionError,
  ProcessNotFoundError,
} from './errors';
import { checkBadWords } from './processes/badWordsDetection';
import { classifyImage } from './processes/imageClassification';
import { buildStoragePath, stripHtml } from './utils';

export class ItemValidationService {
  itemService: ItemService;
  fileService: FileService;
  imageClassifierApi: string;

  constructor(itemService: ItemService, fileService: FileService, imageClassifierApi: string) {
    this.itemService = itemService;
    this.fileService = fileService;
    this.imageClassifierApi = imageClassifierApi;
  }

  async getLastItemValidationGroupForItem(actor, repositories: Repositories, itemId: string) {
    const { itemValidationGroupRepository } = repositories;

    // get item
    const item = await this.itemService.get(actor, repositories, itemId);

    const group = await itemValidationGroupRepository.getLastForItem(itemId);

    // check permissions
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    return group;
  }

  async getItemValidationGroup(actor, repositories: Repositories, itemValidationGroupId: string) {
    const { itemValidationGroupRepository } = repositories;

    const group = await itemValidationGroupRepository.get(itemValidationGroupId);

    await validatePermission(repositories, PermissionLevel.Admin, actor, group.item);

    return group;
  }

  async post(actor, repositories: Repositories, itemId: string) {
    const { itemValidationGroupRepository } = repositories;

    // create folder to store files
    const fileStorage = buildStoragePath(itemId);
    await mkdirSync(fileStorage, {
      recursive: true,
    });

    // create record in item-validation
    const iVG = await itemValidationGroupRepository.post(itemId);

    // get item
    const item = await this.itemService.get(actor, repositories, itemId);

    // create validation and execute for each node recursively
    await this._post(actor, repositories, item, iVG, fileStorage);

    // delete tmp folder
    rmSync(fileStorage, { recursive: true });
  }

  async _post(
    actor,
    repositories: Repositories,
    item: Item,
    itemValidationGroup: ItemValidationGroup,
    fileStorage: string,
  ) {
    // execute each process on item
    await Promise.all(
      Object.values(ItemValidationProcess).map(async (process) => {
        try {
          // if item is not of type 'file', skip the image checking
          if (
            process === ItemValidationProcess.ImageChecking &&
            item?.type !== this.fileService.type
          ) {
            return;
          }

          // create and validate item
          await this.validateItem(
            actor,
            repositories,
            item,
            itemValidationGroup.id,
            process,
            fileStorage,
          );
        } catch (error) {
          throw new ProcessExecutionError(process, error);
        }
      }),
    );

    // recursively validate subitems
    if (item?.type === ItemType.FOLDER) {
      const subItems = await this.itemService.getChildren(actor, repositories, item.id);
      await Promise.all(
        subItems.map(async (subitem) => {
          await this._post(actor, repositories, subitem, itemValidationGroup, fileStorage).catch(
            (error) => {
              throw new ItemValidationError(error);
            },
          );
        }),
      );
    }
  }

  async validateItem(
    actor,
    repositories: Repositories,
    item: Item,
    groupId: string,
    process: ItemValidationProcess,
    fileStorage: string,
  ) {
    const { itemValidationReviewRepository, itemValidationRepository } = repositories;

    // create pending validation
    const itemValidation = await itemValidationRepository.post(item?.id, groupId, process);

    let status = ItemValidationStatus.Pending;
    let result = undefined;
    try {
      switch (process) {
        case ItemValidationProcess.BadWordsDetection:
          const suspiciousFields = checkBadWords([
            { name: 'name', value: item.name },
            { name: 'description', value: stripHtml(item.description) },
          ]);
          result = suspiciousFields;
          status =
            suspiciousFields.length > 0
              ? ItemValidationStatus.Failure
              : ItemValidationStatus.Success;

        case ItemValidationProcess.ImageChecking:
          let filepath = '';
          let mimetype = '';
          // check for service type and assign filepath, mimetype respectively
          if (item?.type === ItemType.S3_FILE) {
            const s3Extra = item?.extra as S3FileItemExtra;
            filepath = s3Extra?.s3File?.path;
            mimetype = s3Extra?.s3File?.mimetype;
          } else {
            const fileExtra = item.extra as LocalFileItemExtra;
            filepath = fileExtra?.file?.path;
            mimetype = fileExtra?.file?.mimetype;
          }

          if (!filepath || !mimetype) {
            throw new InvalidFileItemError(item);
          }

          let ext = path.extname(item.name);
          if (!ext) {
            // only add a dot in case of building file name with mimetype, otherwise there will be two dots in file name
            ext = `.${mime.extension(mimetype)}`;
          }

          // if file is not an image, return success
          if (!IMAGE_FILE_EXTENSIONS.includes(ext)) {
            // TODO: update validation entry
            status = ItemValidationStatus.Success;
          } else {
            const filePath = await this.fileService.download(actor, {
              path: filepath,
              itemId: item?.id,
              mimetype,
              fileStorage,
            });
            const isSafe = await classifyImage(this.imageClassifierApi, filePath);
            status = isSafe ? ItemValidationStatus.Success : ItemValidationStatus.Failure;
          }

        default:
          // TODO: update validation entry
          throw new ProcessNotFoundError(process);
      }
    } catch (error) {
      // log the error
      // log.error(error);
      // if some error happend during the execution of a process, it is counted as failure
      status = ItemValidationStatus.Failure;
      result = error.message;
    } finally {
      // create review entry if validation failed
      if (status === ItemValidationStatus.Failure) {
        await itemValidationReviewRepository.post(
          itemValidation.id,
          ItemValidationReviewStatus.Pending,
        );
      }

      // update item validation
      await itemValidationRepository.patch(itemValidation.id, { result, status });

      return status;
    }
  }
}
