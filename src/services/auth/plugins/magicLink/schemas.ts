import { Type } from '@sinclair/typebox';

import { MAX_USERNAME_LENGTH, MIN_USERNAME_LENGTH } from '@graasp/sdk';

import { SHORT_TOKEN_PARAM } from '../passport';

export const register = {
  body: Type.Object(
    {
      name: Type.String({
        format: 'username',
        minLength: MIN_USERNAME_LENGTH,
        maxLength: MAX_USERNAME_LENGTH,
      }),
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
};
export const login = {
  body: Type.Object(
    {
      email: Type.String({ format: 'email' }),
      captcha: Type.String(),
      url: Type.Optional(Type.String({ format: 'uri' })),
    },
    { additionalProperties: false },
  ),
  querystring: Type.Object(
    {
      lang: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
};
export const auth = {
  querystring: Type.Object(
    {
      [SHORT_TOKEN_PARAM]: Type.String({ format: 'jwt' }),
      url: Type.Optional(Type.String({ format: 'uri-reference' })),
    },
    { additionalProperties: false },
  ),
};
