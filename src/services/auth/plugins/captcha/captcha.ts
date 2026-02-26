import fetch from 'node-fetch';

import { forwarded } from '@fastify/forwarded';
import type { FastifyReply, FastifyRequest, RouteHandlerMethod } from 'fastify';

import type { RecaptchaActionType } from '@graasp/sdk';

import { DEV } from '../../../../config/env';
import { RECAPTCHA_SECRET_ACCESS_KEY } from '../../../../utils/config';
import { AuthenticationError } from './errors';

export const RECAPTCHA_VERIFY_LINK = 'https://www.google.com/recaptcha/api/siteverify';
export const RECAPTCHA_SCORE_THRESHOLD = 0.5;

type CaptchaResponse = { success?: boolean; action?: RecaptchaActionType; score?: number };

/**
 * Prehandler builder to validate the captcha tokens.
 * Routes that use this prehandler should have a body with a `captcha` field.
 * @param action Recaptcha action type
 * @param options Options object. `shouldFail` is a boolean that determines if the route should fail if the score is low.
 * @returns Prehandler route
 */
export default function captchaPreHandler(
  action: RecaptchaActionType,
  options?: { shouldFail: boolean },
): RouteHandlerMethod {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
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
    request.log.error('The captcha verification has thrown: token is undefined');
    throw new AuthenticationError();
  }

  // warning: addresses might contains spoofed ips
  const addresses = forwarded(request.raw);
  const ip = addresses.pop();

  const verificationURL = new URL(RECAPTCHA_VERIFY_LINK);
  const searchParams = new URLSearchParams({
    response: captcha,
    secret: RECAPTCHA_SECRET_ACCESS_KEY,
  });
  if (ip) {
    searchParams.set('remoteip', ip);
  }
  verificationURL.search = searchParams.toString();

  const response = await fetch(verificationURL);
  const data: CaptchaResponse = await response.json();

  // success: true or false wether this request was a valid reCAPTCHA token for your site
  // action: the user interaction that triggered reCAPTCHA verification.
  // score: how probable the user is legit
  if (!isCaptchaValid(data, actionType, shouldFailIfLowScore)) {
    request.log.error(`The captcha verification has thrown with value: '${JSON.stringify(data)}'`);
    throw new AuthenticationError();
  }
}

function isCaptchaValid(
  data: CaptchaResponse,
  actionType: RecaptchaActionType,
  shouldFailIfLowScore: boolean,
) {
  return (
    data &&
    data.success &&
    data.action === actionType &&
    // data.score should be checked for definition not for boolean value
    data.score !== undefined &&
    (!shouldFailIfLowScore || data.score > RECAPTCHA_SCORE_THRESHOLD)
  );
}
