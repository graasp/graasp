import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { error } from '../../../../schemas/fluent-schema';

export const passwordLogin: FastifySchema = {
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

export const setPassword: FastifySchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      password: {
        type: 'string',
        format: 'strongPassword',
      },
    },
  },
  response: {
    [StatusCodes.NO_CONTENT]: { type: 'null' },
    // returns conflict when there is already a password set
    [StatusCodes.CONFLICT]: error,
  },
};

export const updatePassword: FastifySchema = {
  body: {
    type: 'object',
    additionalProperties: false,
    properties: {
      password: { type: 'string', format: 'strongPassword' },
      currentPassword: { type: 'string', format: 'strongPassword' },
    },
  },
  response: {
    [StatusCodes.NO_CONTENT]: { type: 'null' },
    // there was an issue with matching the current password with what is stored or the password was empty
    [StatusCodes.BAD_REQUEST]: error,
    // the user needs to be authenticated and the current password needs to match
    [StatusCodes.UNAUTHORIZED]: error,
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
