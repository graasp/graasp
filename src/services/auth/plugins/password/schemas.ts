import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { error } from '../../../../schemas/fluent-schema';

export const passwordLogin = {
  tags: ['password'],
  summary: 'Log in with email and password',
  description:
    'Log in with email and password. The user must provide a valid email, password, and captcha. The captcha is used to prevent brute force attacks.',
  body: customType.StrictObject({
    email: Type.String({ format: 'email' }),
    password: Type.String(),
    captcha: Type.String(),
    url: Type.Optional(Type.String({ format: 'uri' })),
  }),
  querystring: customType.StrictObject({
    lang: Type.Optional(Type.String()),
  }),
} as const satisfies FastifySchema;

export const setPassword = {
  tags: ['password'],
  summary: 'Set a password for the authenticated member',
  description:
    'Set a password for the authenticated member. This is only possible if the member does not have a password set already.',
  body: customType.StrictObject({
    password: Type.String({ format: 'strongPassword' }),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
    // returns conflict when there is already a password set
    [StatusCodes.CONFLICT]: error,
  },
} as const satisfies FastifySchema;

export const updatePassword = {
  tags: ['password'],
  summary: 'Update the password of the authenticated member',
  description:
    'Update the password of the authenticated member. The user must provide the current password and the new password.',
  body: customType.StrictObject({
    password: Type.String({ format: 'strongPassword' }),
    currentPassword: Type.String({ format: 'strongPassword' }),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
    // there was an issue with matching the current password with what is stored or the password was empty
    [StatusCodes.BAD_REQUEST]: error,
    // the user needs to be authenticated and the current password needs to match
    [StatusCodes.UNAUTHORIZED]: error,
  },
} as const satisfies FastifySchema;

export const postResetPasswordRequest = {
  tags: ['password'],
  summary: 'Create a reset password request',
  description:
    'Create a reset password request. This will send an email to the member in his language with a link to reset the password. The link will be valid for a limited time.',
  body: customType.StrictObject({
    email: Type.String({ format: 'email' }),
    captcha: Type.String(),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: {},
    [StatusCodes.BAD_REQUEST]: {},
  },
} as const satisfies FastifySchema;

export const patchResetPasswordRequest = {
  tags: ['password'],
  summary: 'Confirm the reset password request',
  description:
    'Confirm the reset password request. This will change the password of the member associated with the reset password request.',
  body: customType.StrictObject({
    password: Type.String({ format: 'strongPassword' }),
  }),
  headers: Type.Object({ authorization: Type.String({ format: 'bearer' }) }),
  response: {
    [StatusCodes.NO_CONTENT]: {},
    [StatusCodes.BAD_REQUEST]: {},
  },
} as const satisfies FastifySchema;

export const getMembersCurrentPasswordStatus = {
  tags: ['password', 'current'],
  summary: 'Get the current password status of the authenticated member',
  description: 'Return whether the authenticated member has a password defined.',
  response: {
    [StatusCodes.OK]: customType.StrictObject({ hasPassword: Type.Boolean() }),
  },
} as const satisfies FastifySchema;
