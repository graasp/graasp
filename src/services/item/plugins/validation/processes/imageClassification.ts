import fs from 'fs';
import fetch from 'node-fetch';

import { HttpMethod } from '@graasp/sdk';

import { IMAGE_CLASSIFIER_PREDICTION_THRESHOLD } from '../constants';
import { FailedImageClassificationRequestError } from '../errors';

export const sendRequestToClassifier = async (
  classifierApi: string,
  encodedImage: string,
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
    const response = await fetch(classifierApi, {
      method: HttpMethod.POST,
      body: JSON.stringify(data),
    }).then(res => res.json());
    return response;
  } catch (error) {
    console.log(error);
    throw new FailedImageClassificationRequestError(error);
  }
};

export const classifyImage = async (classifierApi: string, filePath: string): Promise<boolean> => {
  const image = fs.readFileSync(filePath);
  const encodedImage = image.toString('base64');
  const response = await sendRequestToClassifier(classifierApi, encodedImage);

  const prediction = response?.prediction?.image;
  if (!prediction) {
    throw new FailedImageClassificationRequestError('Invalid Response');
  }

  return prediction.unsafe < IMAGE_CLASSIFIER_PREDICTION_THRESHOLD;
};
