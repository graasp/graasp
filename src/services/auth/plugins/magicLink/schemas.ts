import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { SHORT_TOKEN_PARAM } from '../passport';

export const register = {
  operationId: 'register',
  tags: ['authentication'],
  summary: 'Register with email and name',
  description:
    'Register with email and name, protected by a captcha. The captcha is used to prevent brute force attacks.',

  body: Type.Object(
    {
      name: customType.Username(),
      email: Type.String({ format: 'email' }),
      captcha: Type.String(),
      url: Type.Optional(Type.String({ format: 'uri' })),
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
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const login = {
  operationId: 'login',
  tags: ['authentication'],
  summary: 'Login with email',
  description:
    'Login with email, protected by a captcha. The captcha is used to prevent brute force attacks.',

  body: Type.Object(
    {
      email: Type.String({ format: 'email' }),
      captcha: Type.String(),
      url: Type.Optional(Type.String({ format: 'uri' })),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const auth = {
  operationId: 'authenticate',
  tags: ['authentication'],
  summary: 'Authentication validating the token',
  description: 'Authenticate to obtain session cookie given provided token and verifier',

  querystring: Type.Object(
    {
      [SHORT_TOKEN_PARAM]: Type.String({ format: 'jwt' }),
      url: Type.Optional(Type.String({ format: 'uri' })),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.SEE_OTHER]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
