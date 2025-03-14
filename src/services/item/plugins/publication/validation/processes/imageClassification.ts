import fetch from 'node-fetch';
import sharp from 'sharp';

import { HttpMethod, MimeTypes } from '@graasp/sdk';

import { IMAGE_CLASSIFIER_PREDICTION_THRESHOLD } from '../constants.js';
import { FailedImageClassificationRequestError } from '../errors.js';

const imageToBase64 = async (buffer: ArrayBuffer, mimetype?: string) => {
  let imageBuffer = buffer;

  // if image is SVG or unkown, convert it to PNG to solve nudenet issues
  if (!mimetype || mimetype === MimeTypes.Image.SVG) {
    imageBuffer = await sharp(buffer).png().toBuffer();
  }

  return Buffer.from(imageBuffer).toString('base64');
};

const sendRequestToClassifier = async (
  classifierApi: string,
  url: string,
  mimetype?: string,
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
    const encodedImage = await imageToBase64(buffer, mimetype);
    const response = await fetch(classifierApi, {
      method: HttpMethod.Post,
      body: JSON.stringify({ data: { image: encodedImage } }),
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  } catch (error) {
    console.error(error);
    throw new FailedImageClassificationRequestError(error);
  }
};

export const classifyImage = async (
  classifierApi: string,
  url: string,
  mimetype?: string,
): Promise<boolean> => {
  const response = await sendRequestToClassifier(classifierApi, url, mimetype);
  console.debug('image classification result', response);

  const prediction = response?.prediction?.image;
  if (!prediction) {
    throw new FailedImageClassificationRequestError('Invalid Response');
  }

  return prediction.unsafe < IMAGE_CLASSIFIER_PREDICTION_THRESHOLD;
};
