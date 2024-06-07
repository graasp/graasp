import { injectable } from 'tsyringe';

import { readEnvOrThrow } from '../../../../utils/env';

export interface ImageClassifierApi {
  getApi(): string;
}

@injectable()
export class ImageClassifierApiEnv implements ImageClassifierApi {
  private imageClassifierApi: string;

  constructor() {
    this.imageClassifierApi = readEnvOrThrow('IMAGE_CLASSIFIER_API');
  }

  getApi(): string {
    return this.imageClassifierApi;
  }
}
