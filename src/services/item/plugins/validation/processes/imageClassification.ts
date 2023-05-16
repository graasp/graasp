import {  readFileSync } from 'fs';
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
  filePath: string,
): Promise<{
  prediction?: {
    image?: {
      unsafe: number;
      safe: number;
    };
  };
}> => {
  try {
    const image = readFileSync(filePath);
    const encodedImage = image.toString('base64');
    const response = await fetch(classifierApi, {
      method: HttpMethod.POST,
      body: JSON.stringify({data:{image:{encodedImage}}}),
      headers: {'Content-Type': 'application/json'}
    }).then((res) => res.json());
    return response;
  } catch (error) {
    console.error(error);
    throw new FailedImageClassificationRequestError(error);
  }
};

export const classifyImage = async (classifierApi: string, filePath: string): Promise<boolean> => {
  const response = await sendRequestToClassifier(classifierApi, filePath);

  const prediction = response?.prediction?.image;
  if (!prediction) {
    throw new FailedImageClassificationRequestError('Invalid Response');
  }

  return prediction.unsafe < IMAGE_CLASSIFIER_PREDICTION_THRESHOLD;
};
