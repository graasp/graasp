import nock from 'nock';

import { RecaptchaActionType } from '@graasp/sdk';

export function mockCaptchaValidationOnce(action: RecaptchaActionType) {
  nock('https://www.google.com').get('/recaptcha/api/siteverify').query(true).reply(200, {
    success: true,
    action,
    score: 1,
  });
}
export function mockCaptchaValidationWithScore(action: RecaptchaActionType, score: number) {
  nock('https://www.google.com').get('/recaptcha/api/siteverify').query(true).reply(200, {
    success: true,
    action,
    score,
  });
}
