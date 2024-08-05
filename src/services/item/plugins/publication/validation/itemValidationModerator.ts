import { inject, singleton } from 'tsyringe';

import {
  ItemType,
  ItemValidationProcess,
  ItemValidationReviewStatus,
  ItemValidationStatus,
  getMimetype,
} from '@graasp/sdk';

import { IMAGE_CLASSIFIER_API_DI_KEY } from '../../../../../di/constants';
import { Repositories } from '../../../../../utils/repositories';
import FileService from '../../../../file/service';
import { Actor } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemValidationGroup } from './entities/ItemValidationGroup';
import { InvalidFileItemError, ProcessExecutionError } from './errors';
import { detectFieldNameWithBadWords } from './processes/badWordsDetection';
import { classifyImage } from './processes/imageClassification';
import { isImage, stripHtml } from './utils';

type ValidationProcessResult = {
  status: ItemValidationStatus;
  result?: string;
};

type ValidationStrategy = {
  strategy: () => Promise<ValidationProcessResult>;
  process: ItemValidationProcess;
};

@singleton()
export class ItemValidationModerator {
  private readonly fileService: FileService;
  private readonly imageClassifierApi: string;

  constructor(
    fileService: FileService,
    @inject(IMAGE_CLASSIFIER_API_DI_KEY) imageClassifierApi: string,
  ) {
    this.fileService = fileService;
    this.imageClassifierApi = imageClassifierApi;
  }

  private isSameTypeAsFileService(item: Item) {
    return item.type === this.fileService.fileType;
  }

  private async executeItemTextValidation(item: Item): Promise<ValidationProcessResult> {
    const suspiciousFields = detectFieldNameWithBadWords([
      { name: 'name', value: item.name },
      { name: 'description', value: stripHtml(item.description) },
    ]);
    const result = suspiciousFields.join(', ');
    const status =
      suspiciousFields.length > 0 ? ItemValidationStatus.Failure : ItemValidationStatus.Success;

    return { result, status };
  }

  private async executeImageItemValidation(
    item: Item,
    actor: Actor,
  ): Promise<ValidationProcessResult> {
    if (!this.imageClassifierApi) {
      throw new Error('imageClassifierApi is not defined');
    }

    if (!isImage(item)) {
      throw new InvalidFileItemError(item);
    }

    const { path: filepath } = item.type === ItemType.S3_FILE ? item.extra.s3File : item.extra.file;

    // return url
    const url = await this.fileService.getUrl(actor, {
      id: item?.id,
      path: filepath,
    });

    const mimetype = getMimetype(item.extra);
    const isSafe = await classifyImage(this.imageClassifierApi, url, mimetype);
    const status = isSafe ? ItemValidationStatus.Success : ItemValidationStatus.Failure;
    return { status };
  }

  /**
   * Define the different validation processes to run on the given item depending on the type.
   * @param item The item to validate.
   * @param actor The current actor.
   * @returns ValidationStrategy[] An array of validation strategies to apply on the given item.
   */
  private constructItemValidations(item: Item, actor: Actor) {
    const textValidationStrategy = {
      process: ItemValidationProcess.BadWordsDetection,
      strategy: () => this.executeItemTextValidation(item),
    };

    const validationStrategies: ValidationStrategy[] = [textValidationStrategy];

    if (this.isSameTypeAsFileService(item) && isImage(item)) {
      const imageValidationStrategy = {
        process: ItemValidationProcess.ImageChecking,
        strategy: () => this.executeImageItemValidation(item, actor),
      };
      validationStrategies.push(imageValidationStrategy);
    }

    return validationStrategies;
  }

  async validate(
    actor: Actor,
    repositories: Repositories,
    item: Item,
    itemValidationGroup: ItemValidationGroup,
  ): Promise<ItemValidationStatus[]> {
    // execute each process on item
    const results = (
      await Promise.all(
        this.constructItemValidations(item, actor).map(async (validationStrategy) => {
          try {
            return await this.executeValidationProcess(
              repositories,
              item,
              itemValidationGroup.id,
              validationStrategy,
            );
          } catch (error) {
            throw new ProcessExecutionError(validationStrategy.process, error);
          }
        }),
      )
    ).filter((r): r is ItemValidationStatus => Boolean(r));

    return results;
  }

  private async executeValidationProcess(
    repositories: Repositories,
    item: Item,
    groupId: string,
    { process, strategy }: ValidationStrategy,
  ): Promise<ItemValidationStatus> {
    const { itemValidationReviewRepository, itemValidationRepository } = repositories;

    // create pending validation
    const itemValidation = await itemValidationRepository.post(item?.id, groupId, process);

    let status: ItemValidationStatus;
    let result: string | undefined = undefined;

    try {
      ({ status, result } = await strategy());
    } catch (error) {
      // if some error happend during the execution of a process, it is counted as failure
      status = ItemValidationStatus.Failure;
      if (error instanceof Error) {
        result = error.message;
      }
    }

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
