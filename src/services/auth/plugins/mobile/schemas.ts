import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox.js';
import { errorSchemaRef } from '../../../../schemas/global.js';
import { SHORT_TOKEN_PARAM, TOKEN_PARAM } from '../passport/index.js';

const authTokensPairSchemaRef = registerSchemaAsRef(
  'tokensPair',
  'Tokens Pair',
  customType.StrictObject(
    {
      authToken: Type.String(),
      refreshToken: Type.String(),
    },
    {
      description: 'Pair of tokens used for authentication in mobile',
    },
  ),
);

export const mregister = {
  operationId: 'registerMobile',
  tags: ['authentication', 'mobile'],
  summary: 'Register with email and name',
  description:
    'Register with email and name, protected by a captcha and challenge. The captcha and challenge are used to prevent brute force attacks.',

  body: customType.StrictObject({
    name: customType.Username(),
    email: Type.String({ format: 'email' }),
    challenge: Type.String(),
    captcha: Type.String(),
    enableSaveActions: Type.Optional(Type.Boolean()),
  }),
  querystring: customType.StrictObject({
    lang: Type.Optional(Type.String()),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const mlogin = {
  operationId: 'loginMobile',
  tags: ['authentication', 'mobile'],
  summary: 'Login with email',
  description:
    'Login with email, protected by a captcha and challenge. The captcha and challenge are used to prevent brute force attacks.',
  body: customType.StrictObject({
    email: Type.String({ format: 'email' }),
    challenge: Type.String(),
    captcha: Type.String(),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const mPasswordLogin = {
  operationId: 'LoginWithPasswordMobile',
  tags: ['authentication', 'password', 'mobile'],
  summary: 'Login with email and password',
  description:
    'Login with email and password, protected by a captcha and challenge. The captcha and challenge are used to prevent brute force attacks.',
  body: customType.StrictObject({
    email: Type.String({ format: 'email' }),
    challenge: Type.String(),
    password: Type.String(),
    captcha: Type.String(),
  }),
  response: {
    [StatusCodes.OK]: customType.StrictObject(
      { resource: Type.String({ format: 'uri' }) },
      { description: 'Successful Response' },
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const mauth = {
  operationId: 'authenticateMobile',
  tags: ['authentication', 'mobile'],
  summary: 'Authentication validating the token',
  description: 'Authenticate to obtain session cookie given provided token and verifier',
  body: customType.StrictObject({
    [SHORT_TOKEN_PARAM]: Type.String({ format: 'jwt' }),
    verifier: Type.String(),
  }),
  response: {
    [StatusCodes.OK]: authTokensPairSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const authWeb = {
  operationId: 'authenticateMobileToWeb',
  tags: ['authentication', 'mobile'],
  summary: 'Authentication on the web with mobile token',
  description:
    'Obtain session cookie to authenticate on the web given provided mobile JWT token. Redirect to given url.',
  querystring: customType.StrictObject({
    [TOKEN_PARAM]: Type.String({ format: 'jwt' }),
    url: Type.Optional(Type.String({ format: 'uri' })),
  }),
  response: {
    [StatusCodes.SEE_OTHER]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
