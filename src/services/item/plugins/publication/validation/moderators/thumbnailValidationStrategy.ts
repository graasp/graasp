import { inject, injectWithTransform, singleton } from 'tsyringe';

import { ItemValidationProcess, ItemValidationStatus, ThumbnailSize } from '@graasp/sdk';

import { IMAGE_CLASSIFIER_API_DI_KEY } from '../../../../../../di/constants';
import {
  ITEM_THUMBNAIL_PREFIX,
  ThumbnailService,
  ThumbnailServiceTransformer,
} from '../../../../../thumbnail/thumbnail.service';
import { type ItemRaw } from '../../../../item';
import { classifyImage } from '../processes/imageClassification';
import type { ValidationProcessResult, ValidationStrategy } from './types';

@singleton()
export class ThumbnailValidationStrategy implements ValidationStrategy {
  private readonly thumbnailService: ThumbnailService;
  private readonly imageClassifierApi: string;

  public readonly process = ItemValidationProcess.ImageChecking;

  constructor(
    @injectWithTransform(ThumbnailService, ThumbnailServiceTransformer, ITEM_THUMBNAIL_PREFIX)
    thumbnailService: ThumbnailService,
    @inject(IMAGE_CLASSIFIER_API_DI_KEY) imageClassifierApi: string,
  ) {
    this.thumbnailService = thumbnailService;
    this.imageClassifierApi = imageClassifierApi;
  }

  async validate(item: ItemRaw): Promise<ValidationProcessResult> {
    if (!this.imageClassifierApi) {
      throw new Error('imageClassifierApi is not defined');
    }

    const url = await this.thumbnailService.getUrl({
      size: ThumbnailSize.Medium,
      id: item.id,
    });

    const classes = await classifyImage(this.imageClassifierApi, url);
    const isSafe = classes.length === 0;
    const result = classes.map((c) => `${c.class}: ${c.score}`).join(' | ');
    const status = isSafe ? ItemValidationStatus.Success : ItemValidationStatus.Failure;
    return { status, result };
  }
}
