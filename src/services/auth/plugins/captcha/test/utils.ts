import fetch from 'node-fetch';

import { RecaptchaActionType } from '@graasp/sdk';

export const mockCaptchaValidation = (action: RecaptchaActionType) => {
  jest.mock('node-fetch');

  (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
    return { json: async () => ({ success: true, action, score: 1 }) } as any;
  });
};

export const MOCK_CAPTCHA = 'mockedCaptcha';
