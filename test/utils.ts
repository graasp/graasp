import nock from 'nock';
import fetch from 'node-fetch';

import { RecaptchaActionType } from '@graasp/sdk';

export function mockCaptchaValidation(action: RecaptchaActionType) {
  (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { json: async () => ({ success: true, action, score: 1 }) } as any;
  });
}

export function mockCaptchaValidationOnce(action: RecaptchaActionType) {
  nock('https://www.google.com').get('/recaptcha/api/siteverify').query(true).reply(200, {
    success: true,
    action,
    score: 1,
  });
}

export const tokenRegex = /\?t=([\w\-\.]{1,1000})/;
