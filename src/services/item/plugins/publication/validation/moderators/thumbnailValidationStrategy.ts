import { inject, injectWithTransform, singleton } from 'tsyringe';

import { ItemValidationProcess, ItemValidationStatus, ThumbnailSize } from '@graasp/sdk';

import { IMAGE_CLASSIFIER_API_DI_KEY } from '../../../../../../di/constants';
import {
  ITEM_THUMBNAIL_PREFIX,
  ThumbnailService,
  ThumbnailServiceTransformer,
} from '../../../../../thumbnail/service';
import { Item } from '../../../../entities/Item';
import { classifyImage } from '../processes/imageClassification';
import { ValidationProcessResult, ValidationStrategy } from './types';

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

  async validate(item: Item): Promise<ValidationProcessResult> {
    if (!this.imageClassifierApi) {
      throw new Error('imageClassifierApi is not defined');
    }

    const url = await this.thumbnailService.getUrl({
      size: ThumbnailSize.Medium,
      id: item.id,
    });

    const isSafe = await classifyImage(this.imageClassifierApi, url);
    const status = isSafe ? ItemValidationStatus.Success : ItemValidationStatus.Failure;
    return { status };
  }
}
