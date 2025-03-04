import { inject, singleton } from 'tsyringe';

import { ItemType, ItemValidationProcess, ItemValidationStatus, getMimetype } from '@graasp/sdk';

import { IMAGE_CLASSIFIER_API_DI_KEY } from '../../../../../../di/constants';
import { Item } from '../../../../../../drizzle/types';
import FileService from '../../../../../file/service';
import { InvalidFileItemError } from '../errors';
import { classifyImage } from '../processes/imageClassification';
import { isImage } from '../utils';
import { ValidationProcessResult, ValidationStrategy } from './types';

@singleton()
export class ImageValidationStrategy implements ValidationStrategy {
  private readonly fileService: FileService;
  private readonly imageClassifierApi: string;

  public readonly process = ItemValidationProcess.ImageChecking;

  constructor(
    fileService: FileService,
    @inject(IMAGE_CLASSIFIER_API_DI_KEY) imageClassifierApi: string,
  ) {
    this.fileService = fileService;
    this.imageClassifierApi = imageClassifierApi;
  }

  async validate(item: Item): Promise<ValidationProcessResult> {
    if (!this.imageClassifierApi) {
      throw new Error('imageClassifierApi is not defined');
    }

    if (!isImage(item)) {
      throw new InvalidFileItemError(item);
    }

    const { path: filepath } = item.type === ItemType.S3_FILE ? item.extra.s3File : item.extra.file;

    // return url
    const url = await this.fileService.getUrl({
      path: filepath,
    });

    const mimetype = getMimetype(item.extra);
    const isSafe = await classifyImage(this.imageClassifierApi, url, mimetype);
    const status = isSafe ? ItemValidationStatus.Success : ItemValidationStatus.Failure;
    return { status };
  }
}
