import fetch from 'node-fetch';

import { RecaptchaActionType } from '@graasp/sdk';

export function mockCaptchaValidation(action: RecaptchaActionType) {
  (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { json: async () => ({ success: true, action, score: 1 }) } as any;
  });
}
