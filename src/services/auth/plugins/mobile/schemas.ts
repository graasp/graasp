import { SHORT_TOKEN_PARAM, TOKEN_PARAM } from '../passport';

export const mregister = {
  body: {
    type: 'object',
    required: ['name', 'email', 'challenge', 'captcha'],
    properties: {
      name: { type: 'string', pattern: '^\\S+( \\S+)*$' },
      email: { type: 'string', format: 'email' },
      challenge: { type: 'string' },
      captcha: { type: 'string' },
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

export const mlogin = {
  body: {
    type: 'object',
    required: ['email', 'challenge', 'captcha'],
    properties: {
      email: { type: 'string', format: 'email' },
      challenge: { type: 'string' },
      captcha: { type: 'string' },
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

export const mPasswordLogin = {
  body: {
    type: 'object',
    required: ['email', 'challenge', 'password', 'captcha'],
    properties: {
      email: { type: 'string', format: 'email' },
      challenge: { type: 'string' },
      password: { type: 'string' },
      captcha: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export const mauth = {
  body: {
    type: 'object',
    required: [SHORT_TOKEN_PARAM, 'verifier'],
    properties: {
      [SHORT_TOKEN_PARAM]: { type: 'string' },
      verifier: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export const authWeb = {
  querystring: {
    type: 'object',
    required: [TOKEN_PARAM],
    properties: {
      [TOKEN_PARAM]: { type: 'string' },
      url: { type: 'string' },
    },
    additionalProperties: false,
  },
};
