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
  url: string,
): Promise<{
  prediction?: {
    image?: {
      unsafe: number;
      safe: number;
    };
  };
}> => {
  try {
    const imageUrlData = await fetch(url);
    const buffer = await imageUrlData.arrayBuffer();
    const encodedImage = Buffer.from(buffer).toString('base64');
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

export const classifyImage = async (classifierApi: string, url: string): Promise<boolean> => {
  const response = await sendRequestToClassifier(classifierApi, url);

  const prediction = response?.prediction?.image;
  if (!prediction) {
    throw new FailedImageClassificationRequestError('Invalid Response');
  }

  return prediction.unsafe < IMAGE_CLASSIFIER_PREDICTION_THRESHOLD;
};
