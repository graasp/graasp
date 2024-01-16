import fetch from 'node-fetch';
import qs from 'qs';

import forwarded from '@fastify/forwarded';
import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fastifyPlugin from 'fastify-plugin';

import { RecaptchaActionType } from '@graasp/sdk';

import { DEV } from '../../../../utils/config';
import { AuthenticationError } from './errors';

export const RECAPTCHA_VERIFY_LINK = 'https://www.google.com/recaptcha/api/siteverify';
export const RECAPTCHA_SCORE_THRESHOLD = 0.5;

// todo: this does not really need to be a fastify plugin?
const plugin: FastifyPluginAsync<{ secretAccessKey: string }> = async (fastify, options) => {
  const { secretAccessKey } = options;

  if (!secretAccessKey) {
    console.error('Captcha secretAccessKey environment variable missing.');
    process.exit(1);
  }

  const validateCaptcha = async (
    request: FastifyRequest,
    captcha: string,
    actionType: RecaptchaActionType,
    options?: { shouldFail: boolean },
  ) => {
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
        secret: secretAccessKey,
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
  };

  fastify.decorate('validateCaptcha', validateCaptcha);
};

export default fastifyPlugin(plugin);
