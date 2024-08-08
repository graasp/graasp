import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { error } from '../../../../schemas/fluent-schema';

export const passwordLogin: FastifySchema = {
  tags: ['password'],
  summary: 'Log in with email and password',
  description:
    'Log in with email and password. The user must provide a valid email, password, and captcha. The captcha is used to prevent brute force attacks.',
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
  tags: ['password'],
  summary: 'Set a password for the authenticated member',
  description:
    'Set a password for the authenticated member. This is only possible if the member does not have a password set already.',
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
  tags: ['password'],
  summary: 'Update the password of the authenticated member',
  description:
    'Update the password of the authenticated member. The user must provide the current password and the new password.',
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
  tags: ['password'],
  summary: 'Create a reset password request',
  description:
    'Create a reset password request. This will send an email to the member in his language with a link to reset the password. The link will be valid for a limited time.',
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
  tags: ['password'],
  summary: 'Confirm the reset password request',
  description:
    'Confirm the reset password request. This will change the password of the member associated with the reset password request.',
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

export const getMembersCurrentPasswordStatus: FastifySchema = {
  tags: ['password', 'current'],
  summary: 'Get the current password status of the authenticated member',
  description: 'Return whether the authenticated member has a password defined.',
  response: {
    [StatusCodes.OK]: {
      type: 'object',
      properties: {
        hasPassword: { type: 'boolean' },
      },
    },
  },
};
