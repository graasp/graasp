import { mkdirSync } from 'fs';
import path from 'path';

import {
  ItemType,
  ItemValidationProcess,
  ItemValidationReviewStatus,
  ItemValidationStatus,
  MimeTypes,
  PermissionLevel,
  UUID,
} from '@graasp/sdk';

import { TMP_FOLDER } from '../../../../utils/config';
import { Repositories } from '../../../../utils/repositories';
import { validatePermission } from '../../../authorization';
import FileService from '../../../file/service';
import { Member } from '../../../member/entities/member';
import { Item, isItemType } from '../../entities/Item';
import { ItemService } from '../../service';
import { ItemValidationGroup } from './entities/ItemValidationGroup';
import {
  InvalidFileItemError,
  ItemValidationError,
  ProcessExecutionError,
  ProcessNotFoundError,
} from './errors';
import { detectFieldNameWithBadWords } from './processes/badWordsDetection';
import { classifyImage } from './processes/imageClassification';
import { stripHtml } from './utils';

export class ItemValidationService {
  itemService: ItemService;
  fileService: FileService;
  imageClassifierApi?: string;

  constructor(itemService: ItemService, fileService: FileService, imageClassifierApi?: string) {
    this.itemService = itemService;
    this.fileService = fileService;
    this.imageClassifierApi = imageClassifierApi;
  }

  buildStoragePath(itemValidationId: UUID) {
    const p = path.join(TMP_FOLDER, 'validation', itemValidationId);
    mkdirSync(p, { recursive: true });
    return p;
  }

  async getLastItemValidationGroupForItem(
    actor: Member,
    repositories: Repositories,
    itemId: string,
  ) {
    const { itemValidationGroupRepository } = repositories;

    // get item
    const item = await this.itemService.get(actor, repositories, itemId);

    const group = await itemValidationGroupRepository.getLastForItem(itemId);

    // check permissions
    await validatePermission(repositories, PermissionLevel.Admin, actor, item);

    return group;
  }

  async getItemValidationGroup(
    actor: Member,
    repositories: Repositories,
    itemValidationGroupId: string,
  ) {
    const { itemValidationGroupRepository } = repositories;

    const group = await itemValidationGroupRepository.get(itemValidationGroupId);

    await validatePermission(repositories, PermissionLevel.Admin, actor, group.item);

    return group;
  }

  async post(member: Member, repositories: Repositories, itemId: string) {
    const { itemValidationGroupRepository } = repositories;

    // get item and check permission
    const item = await this.itemService.get(member, repositories, itemId);
    await validatePermission(repositories, PermissionLevel.Admin, member, item);

    // create record in item-validation
    const iVG = await itemValidationGroupRepository.post(itemId);

    // create validation and execute for each node recursively
    const allResults = await this._post(member, repositories, item, iVG);
    // ensure that all validations have successeeded.
    const hasValidationSucceeded = allResults.every((v) => v === ItemValidationStatus.Success);

    return { item, hasValidationSucceeded };
  }

  async _post(
    actor: Member,
    repositories: Repositories,
    item: Item,
    itemValidationGroup: ItemValidationGroup,
  ): Promise<ItemValidationStatus[]> {
    // execute each process on item
    const results = (
      await Promise.all(
        // todo: add more validation processes to this array
        [ItemValidationProcess.ImageChecking, ItemValidationProcess.BadWordsDetection].map(
          async (process) => {
            try {
              // if item is not of type 'file', skip the image checking
              if (
                process === ItemValidationProcess.ImageChecking &&
                item?.type !== this.fileService.type
              ) {
                return undefined;
              }

              // create and validate item
              return await this.validateItem(
                actor,
                repositories,
                item,
                itemValidationGroup.id,
                process,
              );
            } catch (error) {
              throw new ProcessExecutionError(process, error);
            }
          },
        ),
      )
    ).filter((r): r is ItemValidationStatus => Boolean(r));

    // recursively validate subitems
    if (item?.type === ItemType.FOLDER) {
      const subItems = await this.itemService.getChildren(actor, repositories, item.id);
      const childrenResults = await Promise.all(
        subItems.map(async (subitem) => {
          return await this._post(actor, repositories, subitem, itemValidationGroup).catch(
            (error) => {
              throw new ItemValidationError(error);
            },
          );
        }),
      );

      return results.concat(...childrenResults);
    }

    return results;
  }

  async validateItem(
    actor: Member,
    repositories: Repositories,
    item: Item,
    groupId: string,
    process: ItemValidationProcess,
  ): Promise<ItemValidationStatus> {
    const { itemValidationReviewRepository, itemValidationRepository } = repositories;

    // create pending validation
    const itemValidation = await itemValidationRepository.post(item?.id, groupId, process);

    let status = ItemValidationStatus.Pending;
    let result: string | undefined = undefined;
    try {
      switch (process) {
        case ItemValidationProcess.BadWordsDetection:
          const suspiciousFields = detectFieldNameWithBadWords([
            { name: 'name', value: item.name },
            { name: 'description', value: stripHtml(item.description) },
          ]);
          result = suspiciousFields.join(', ');
          status =
            suspiciousFields.length > 0
              ? ItemValidationStatus.Failure
              : ItemValidationStatus.Success;
          break;

        case ItemValidationProcess.ImageChecking:
          if (isItemType(item, ItemType.S3_FILE) || isItemType(item, ItemType.LOCAL_FILE)) {
            const { path: filepath, mimetype } =
              item.type === ItemType.S3_FILE ? item.extra.s3File : item.extra.file;

            // if file is not an image, return success
            if (!MimeTypes.isImage(mimetype)) {
              // TODO: update validation entry
              status = ItemValidationStatus.Success;
            } else {
              if (!this.imageClassifierApi) {
                throw new Error('imageClassifierApi is not defined');
              }
              // return url
              const url = await this.fileService.getUrl(actor, {
                id: item?.id,
                path: filepath,
              });
              const isSafe = await classifyImage(this.imageClassifierApi, url);
              status = isSafe ? ItemValidationStatus.Success : ItemValidationStatus.Failure;
            }
          } else {
            throw new InvalidFileItemError(item);
          }
          break;

        default:
          // TODO: update validation entry
          throw new ProcessNotFoundError(process);
      }
    } catch (error) {
      // log the error
      // log.error(error);
      // if some error happend during the execution of a process, it is counted as failure
      status = ItemValidationStatus.Failure;
      if (error instanceof Error) {
        result = error.message;
      }
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
