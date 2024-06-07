import { MAX_USERNAME_LENGTH, MIN_USERNAME_LENGTH } from '@graasp/sdk';

import { NAME_REGEX } from '../../../../schemas/global';
import { SHORT_TOKEN_PARAM } from '../passport';

export const register = {
  body: {
    type: 'object',
    required: ['name', 'email', 'captcha'],
    properties: {
      name: {
        type: 'string',
        minLength: MIN_USERNAME_LENGTH,
        maxLength: MAX_USERNAME_LENGTH,
        pattern: NAME_REGEX,
      },
      email: { type: 'string', format: 'email' },
      captcha: { type: 'string' },
      url: {
        type: 'string',
        format: 'uri',
      },
      enableSaveActions: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  querystring: {
    type: 'object',
    properties: {
      lang: { type: 'string' },
    },
    additionalProperties: false,
  },
};
export const login = {
  body: {
    type: 'object',
    required: ['email', 'captcha'],
    properties: {
      email: { type: 'string', format: 'email' },
      captcha: { type: 'string' },
      url: {
        type: 'string',
        format: 'uri',
      },
    },
    additionalProperties: false,
  },
  querystring: {
    type: 'object',
    properties: {
      lang: { type: 'string' },
    },
    additionalProperties: false,
  },
};
export const auth = {
  querystring: {
    type: 'object',
    required: [SHORT_TOKEN_PARAM],
    properties: {
      t: {
        type: 'string',
        format: 'jwt',
      },
      url: {
        type: 'string',
        format: 'uri-reference',
      },
    },
    additionalProperties: false,
  },
};
