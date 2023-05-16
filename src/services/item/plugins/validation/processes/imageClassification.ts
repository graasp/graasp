import { ReadStream } from 'fs';
import fetch from 'node-fetch';

import { HttpMethod } from '@graasp/sdk';

import { IMAGE_CLASSIFIER_PREDICTION_THRESHOLD } from '../constants';
import { FailedImageClassificationRequestError } from '../errors';

/**
 *
 * @param classifierApi
 * @param encodedImage image in base64 read stream
 * @returns classifier response
 */
export const sendRequestToClassifier = async (
  classifierApi: string,
  encodedImage: ReadStream,
): Promise<{
  prediction?: {
    image?: {
      unsafe: number;
      safe: number;
    };
  };
}> => {
  const data = { image: encodedImage };
  try {
    console.log(data);
    const response = await fetch(classifierApi, {
      method: HttpMethod.POST,
      body: JSON.stringify(data),
      headers: {'Content-Type': 'application/json'}
    }).then((res) => res.json());
    return response;
  } catch (error) {
    console.error(error);
    throw new FailedImageClassificationRequestError(error);
  }
};

export const classifyImage = async (classifierApi: string, image: ReadStream): Promise<boolean> => {
  const response = await sendRequestToClassifier(classifierApi, image);

  const prediction = response?.prediction?.image;
  if (!prediction) {
    throw new FailedImageClassificationRequestError('Invalid Response');
  }

  return prediction.unsafe < IMAGE_CLASSIFIER_PREDICTION_THRESHOLD;
};
