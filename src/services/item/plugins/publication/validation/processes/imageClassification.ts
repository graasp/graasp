import sharp from 'sharp';

import { HttpMethod, MimeTypes } from '@graasp/sdk';

import { IMAGE_CLASSIFIER_PREDICTION_THRESHOLD } from '../constants';
import { FailedImageClassificationRequestError } from '../errors';

type PredictionResult = {
  class: string;
  score: number;
  box: [number, number, number, number];
};
type ClassificationResponse = {
  prediction: PredictionResult[][];
  success: boolean;
};

const imageToBlob = async (buffer: ArrayBuffer, mimetype?: string) => {
  let imageBuffer = buffer;

  // if image is SVG or unkown, convert it to PNG to solve nudenet issues
  if (!mimetype || mimetype === MimeTypes.Image.SVG) {
    imageBuffer = await sharp(buffer).png().toBuffer();
  }

  return new Blob([imageBuffer]);
};

const sendRequestToClassifier = async (
  classifierApi: string,
  url: string,
  mimetype?: string,
): Promise<{
  prediction?: PredictionResult[][];
  success: boolean;
  isSafe: boolean;
}> => {
  try {
    const imageUrlData = await fetch(url);
    const buffer = await imageUrlData.arrayBuffer();
    const encodedImage = await imageToBlob(buffer, mimetype);
    const formData = new FormData();
    formData.append('file', encodedImage);
    const response = await fetch(classifierApi, {
      method: HttpMethod.Post,
      body: formData,
    });
    const classificationResult = (await response.json()) as ClassificationResponse;
    // for every image sent, every object predicted MUST be below the threshold to pass the validation
    const isSafe = classificationResult.prediction.every((pred) =>
      pred.every(({ score }) => score < IMAGE_CLASSIFIER_PREDICTION_THRESHOLD),
    );
    console.log(JSON.stringify(classificationResult));
    console.log(classificationResult.prediction[0].map((c) => c.score));
    return { ...classificationResult, isSafe };
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

  const isSafe = response?.isSafe;
  // if (!isSafe) {
  //   throw new FailedImageClassificationRequestError('Invalid Response');
  // }

  // return isUnsafe < IMAGE_CLASSIFIER_PREDICTION_THRESHOLD;
  return isSafe;
};
