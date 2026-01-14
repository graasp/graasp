import FormData from 'form-data';
import fetch from 'node-fetch';

import { IMAGE_CLASSIFIER_PREDICTION_THRESHOLD } from '../constants';
import { FailedImageClassificationRequestError } from '../errors';

type ClassPrediction = {
  class: string;
  score: number;
  box: [number, number, number, number];
};
type ClassificationResponse = {
  prediction?: (ClassPrediction[] | { success: false; reason: string })[];
  success: boolean;
};

const CLASSIFIER_LABELS = [
  // 'FEMALE_GENITALIA_COVERED',
  // 'FACE_FEMALE',
  'BUTTOCKS_EXPOSED',
  'FEMALE_BREAST_EXPOSED',
  'FEMALE_GENITALIA_EXPOSED',
  // 'MALE_BREAST_EXPOSED',
  'ANUS_EXPOSED',
  // 'FEET_EXPOSED',
  // 'BELLY_COVERED',
  // 'FEET_COVERED',
  // 'ARMPITS_COVERED',
  // 'ARMPITS_EXPOSED',
  // 'FACE_MALE',
  // 'BELLY_EXPOSED',
  'MALE_GENITALIA_EXPOSED',
  // 'ANUS_COVERED',
  // 'FEMALE_BREAST_COVERED',
  // 'BUTTOCKS_COVERED',
];

const sendRequestToClassifier = async (
  classifierApi: string,
  url: string,
): Promise<ClassificationResponse> => {
  try {
    const imageUrlData = await fetch(url);
    const buffer = await imageUrlData.buffer();

    // Create a FormData instance
    const form = new FormData();
    form.append('f1', buffer, {
      filename: 'file',
      contentType: imageUrlData.headers.get('content-type') || 'application/octet-stream',
      knownLength: buffer.length,
    });

    const contentLength = form.getLengthSync();

    const headers = {
      ...form.getHeaders(),
      'Content-Length': contentLength.toString(),
    };

    // Send the form using fetch
    const response = await fetch(classifierApi, {
      method: 'POST',
      body: form,
      headers,
    });
    const classificationResult: ClassificationResponse = await response.json();
    return classificationResult;
  } catch (error) {
    console.error(error);
    throw new FailedImageClassificationRequestError(error);
  }
};

export const classifyImage = async (
  classifierApi: string,
  url: string,
): Promise<ClassPrediction[]> => {
  const response = await sendRequestToClassifier(classifierApi, url);
  console.debug('image classification result', response.prediction);

  // only a single image at a time
  const prediction = response?.prediction?.at(0);
  if (!prediction) {
    throw new FailedImageClassificationRequestError('Invalid Response');
  }
  if (!Array.isArray(prediction)) {
    // there was nothing to predict on, so there are no nudity labels
    return [];
  }

  const nudityLabels = prediction.filter(
    ({ class: label, score }) =>
      CLASSIFIER_LABELS.includes(label) && score >= IMAGE_CLASSIFIER_PREDICTION_THRESHOLD,
  );

  return nudityLabels;
};
