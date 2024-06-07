import { injectable } from 'tsyringe';

import { readEnv } from '../../../../utils/env';

export interface ImageClassifierApi {
  getApi(): string | undefined;
}

@injectable()
export class ImageClassifierApiEnv implements ImageClassifierApi {
  private imageClassifierApi?: string;

  constructor() {
    this.imageClassifierApi = readEnv('IMAGE_CLASSIFIER_API');
  }

  getApi() {
    return this.imageClassifierApi;
  }
}
