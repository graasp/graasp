import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { MAX_USERNAME_LENGTH, MIN_USERNAME_LENGTH } from '@graasp/sdk';

import { SHORT_TOKEN_PARAM, TOKEN_PARAM } from '../passport';

export const mregister = {
  body: Type.Object(
    {
      name: Type.String({
        format: 'username',
        minLength: MIN_USERNAME_LENGTH,
        maxLength: MAX_USERNAME_LENGTH,
      }),
      email: Type.String({ format: 'email' }),
      challenge: Type.String(),
      captcha: Type.String(),
      enableSaveActions: Type.Optional(Type.Boolean()),
    },
    { additionalProperties: false },
  ),
  querystring: Type.Object(
    {
      lang: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
  },
} as const satisfies FastifySchema;

export const mlogin = {
  body: Type.Object(
    {
      email: Type.String({ format: 'email' }),
      challenge: Type.String(),
      captcha: Type.String(),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
  },
} as const satisfies FastifySchema;

export const mPasswordLogin = {
  body: Type.Object(
    {
      email: Type.String({ format: 'email' }),
      challenge: Type.String(),
      password: Type.String(),
      captcha: Type.String(),
    },
    { additionalProperties: false },
  ),
} as const satisfies FastifySchema;

export const mauth = {
  body: Type.Object(
    {
      [SHORT_TOKEN_PARAM]: Type.String({ format: 'jwt' }),
      verifier: Type.String(),
    },
    { additionalProperties: false },
  ),
} as const satisfies FastifySchema;

export const authWeb = {
  querystring: Type.Object(
    {
      [TOKEN_PARAM]: Type.String({ format: 'jwt' }),
      url: Type.Optional(Type.String({ format: 'uri' })),
    },
    { additionalProperties: false },
  ),
} as const satisfies FastifySchema;
