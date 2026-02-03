import { inject, singleton } from 'tsyringe';

import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { IMAGE_CLASSIFIER_API_DI_KEY } from '../../../../../../di/constants';
import { type ItemRaw } from '../../../../../../drizzle/types';
import FileService from '../../../../../file/file.service';
import { InvalidFileItemError } from '../errors';
import { classifyImage } from '../processes/imageClassification';
import { isImage } from '../utils';
import type { ValidationProcessResult, ValidationStrategy } from './types';

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

  async validate(item: ItemRaw): Promise<ValidationProcessResult> {
    if (!this.imageClassifierApi) {
      throw new Error('imageClassifierApi is not defined');
    }

    if (!isImage(item)) {
      throw new InvalidFileItemError(item);
    }

    const { path: filepath } = item.extra['file'];

    // return url
    const url = await this.fileService.getUrl({
      path: filepath,
    });

    const classes = await classifyImage(this.imageClassifierApi, url);
    const isSafe = classes.length === 0;
    const result = classes.map((c) => `${c.class}: ${c.score}`).join(' | ');
    const status = isSafe ? ItemValidationStatus.Success : ItemValidationStatus.Failure;
    return { status, result };
  }
}
