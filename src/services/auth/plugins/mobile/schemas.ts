import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { SHORT_TOKEN_PARAM, TOKEN_PARAM } from '../passport';

const authTokensPairSchemaRef = registerSchemaAsRef(
  'tokensPair',
  'Tokens Pair',
  Type.Object(
    {
      authToken: Type.String(),
      refreshToken: Type.String(),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const mregister = {
  tags: ['authentication', 'mobile'],
  summary: 'Register with email and name',
  description:
    'Register with email and name, protected by a captcha and challenge. The captcha and challenge are used to prevent brute force attacks.',

  body: Type.Object(
    {
      name: customType.Username(),
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
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const mlogin = {
  tags: ['authentication', 'mobile'],
  summary: 'Login with email',
  description:
    'Login with email, protected by a captcha and challenge. The captcha and challenge are used to prevent brute force attacks.',
  body: Type.Object(
    {
      email: Type.String({ format: 'email' }),
      challenge: Type.String(),
      captcha: Type.String(),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const mPasswordLogin = {
  tags: ['authentication', 'password', 'mobile'],
  summary: 'Login with email and password',
  description:
    'Login with email and password, protected by a captcha and challenge. The captcha and challenge are used to prevent brute force attacks.',
  body: Type.Object(
    {
      email: Type.String({ format: 'email' }),
      challenge: Type.String(),
      password: Type.String(),
      captcha: Type.String(),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: Type.Object(
      { resource: Type.String({ format: 'uri' }) },
      { description: 'Successful Response' },
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const mauth = {
  tags: ['authentication', 'mobile'],
  summary: 'Authentication validating the token',
  description: 'Authenticate to obtain session cookie given provided token and verifier',
  body: Type.Object(
    {
      [SHORT_TOKEN_PARAM]: Type.String({ format: 'jwt' }),
      verifier: Type.String(),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: authTokensPairSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const authWeb = {
  tags: ['authentication', 'mobile'],
  summary: 'Authentication on the web with mobile token',
  description:
    'Obtain session cookie to authenticate on the web given provided mobile JWT token. Redirect to given url.',
  querystring: Type.Object(
    {
      [TOKEN_PARAM]: Type.String({ format: 'jwt' }),
      url: Type.Optional(Type.String({ format: 'uri' })),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.SEE_OTHER]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
