import { Type } from '@sinclair/typebox';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { SHORT_TOKEN_PARAM } from '../passport';

export const register = {
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
} as const satisfies FastifySchema;

export const login = {
  body: Type.Object(
    {
      email: Type.String({ format: 'email' }),
      captcha: Type.String(),
      url: Type.Optional(Type.String({ format: 'uri' })),
    },
    { additionalProperties: false },
  ),
} as const satisfies FastifySchema;

export const auth = {
  querystring: Type.Object(
    {
      [SHORT_TOKEN_PARAM]: Type.String({ format: 'jwt' }),
      url: Type.Optional(Type.String({ format: 'uri' })),
    },
    { additionalProperties: false },
  ),
} as const satisfies FastifySchema;
