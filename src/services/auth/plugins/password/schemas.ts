import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

export const passwordLogin = {
  body: {
    type: 'object',
    required: ['email', 'password', 'captcha'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', format: 'strongPassword' },
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

export const updatePassword = {
  body: {
    type: 'object',
    properties: {
      password: { type: 'string', format: 'strongPassword' },
      currentPassword: { type: 'string', format: 'strongPassword' },
    },
    additionalProperties: false,
  },
  response: {
    [StatusCodes.OK]: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
      },
      additionalProperties: false,
    },
  },
};

export const postResetPasswordRequest: FastifySchema = {
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      captcha: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    [StatusCodes.NO_CONTENT]: {},
    [StatusCodes.BAD_REQUEST]: {},
  },
};
export const patchResetPasswordRequest: FastifySchema = {
  body: {
    type: 'object',
    properties: {
      password: { type: 'string', format: 'strongPassword' },
    },
    additionalProperties: false,
  },
  headers: {
    type: 'object',
    properties: {
      authorization: { type: 'string', format: 'bearer' },
    },
  },
  response: {
    [StatusCodes.NO_CONTENT]: {},
    [StatusCodes.BAD_REQUEST]: {},
  },
};
