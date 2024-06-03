import fetch from 'node-fetch';
import qs from 'qs';

import forwarded from '@fastify/forwarded';
import { FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';

import { RecaptchaActionType } from '@graasp/sdk';

import { DEV, RECAPTCHA_SECRET_ACCESS_KEY } from '../../../../utils/config';
import { AuthenticationError } from './errors';

export const RECAPTCHA_VERIFY_LINK = 'https://www.google.com/recaptcha/api/siteverify';
export const RECAPTCHA_SCORE_THRESHOLD = 0.5;

/**
 * Prehandler builder to validate the captcha tokens.
 * Routes that use this prehandler should have a body with a `captcha` field.
 * @param action Recaptcha action type
 * @param options
 * @returns Prehandler route
 */
export default function captchaPreHandler(
  action: RecaptchaActionType,
  options?: { shouldFail: boolean },
): RouteHandlerMethod {
  return async (request: FastifyRequest<{ Body: { captcha: string } }>, _reply: FastifyReply) => {
    const { captcha } = request.body;
    return await validateCaptcha(request, captcha, action, options);
  };
}

async function validateCaptcha(
  request: FastifyRequest,
  captcha: string,
  actionType: RecaptchaActionType,
  options?: { shouldFail: boolean },
) {
  const shouldFailIfLowScore = options?.shouldFail ?? true;
  // TODO: find a better solution? to allow dev
  if (DEV) {
    return;
  }

  if (!captcha) {
    console.error('The captcha verification has thrown: token is undefined');
    throw new AuthenticationError();
  }

  // warning: addresses might contained spoofed ips
  const addresses = forwarded(request.raw);
  const ip = addresses.pop();

  const verificationURL = `${RECAPTCHA_VERIFY_LINK}${qs.stringify(
    {
      response: captcha,
      secret: RECAPTCHA_SECRET_ACCESS_KEY,
      remoteip: ip,
    },
    {
      addQueryPrefix: true,
    },
  )}`;

  const response = await fetch(verificationURL);
  const data: { success?: boolean; action?: RecaptchaActionType; score?: number } =
    await response.json();

  // success: comes from my website
  // action: triggered from the correct endpoint
  // score: how probable the user is legit
  if (
    !data ||
    !data.success ||
    data.action !== actionType ||
    // data.score should be checked for definition not for boolean value
    data.score == undefined ||
    (shouldFailIfLowScore && data.score < RECAPTCHA_SCORE_THRESHOLD)
  ) {
    console.error(`The captcha verification has thrown with value: '${JSON.stringify(data)}'`);
    throw new AuthenticationError();
  }
}
