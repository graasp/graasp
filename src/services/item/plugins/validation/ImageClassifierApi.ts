import { injectable } from 'tsyringe';

import { IMAGE_CLASSIFIER_API } from '../../../../utils/config';

export interface ImageClassifierApi {
  getApi(): string;
}

@injectable()
export class ImageClassifierApiEnv implements ImageClassifierApi {
  private imageClassifierApi: string;

  constructor() {
    this.imageClassifierApi = IMAGE_CLASSIFIER_API;
  }

  getApi(): string {
    return this.imageClassifierApi;
  }
}
