import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { ShortLinkPlatform } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

const shortLink = customType.StrictObject({
  itemId: customType.UUID(),
  alias: Type.String({ minLength: 6, maxLength: 255, pattern: '^[a-zA-Z0-9-]*$' }),
  platform: Type.Enum(ShortLinkPlatform),
});

const shortLinkAlias = Type.Pick(shortLink, ['alias']);
const shortLinkPlatformResponse = Type.Object({
  alias: Type.String(),
  url: Type.String({ format: 'uri' }),
});

export const getRedirection = {
  operationId: 'getShortLinkRedirection',
  tags: ['short-link'],
  summary: 'Get redirection for short link',
  description: 'Get redirection for given short link.',

  params: shortLinkAlias,
  response: {
    [StatusCodes.MOVED_TEMPORARILY]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getAvailable = {
  operationId: 'getShortLinkAvailability',
  tags: ['short-link'],
  summary: 'Get whether an alias is available',
  description: 'Get whether an alias is available.',

  params: shortLinkAlias,
  response: {
    [StatusCodes.OK]: Type.Object({ available: Type.Boolean() }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getAllByItem = {
  operationId: 'getShortLinksForItem',
  tags: ['short-link'],
  summary: 'Get all short links for item',
  description:
    'Get all short links created for an item. The response could be an empty object or a key-value with at least one platform and the alias.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Union([
      customType.StrictObject(
        {
          [ShortLinkPlatform.Builder]: Type.Optional(shortLinkPlatformResponse),
          [ShortLinkPlatform.Player]: Type.Optional(shortLinkPlatformResponse),
          [ShortLinkPlatform.Library]: Type.Optional(shortLinkPlatformResponse),
        },
        { minProperties: 1 },
      ),
      customType.StrictObject({}),
    ]),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const createShortLink = {
  operationId: 'createShortLink',
  tags: ['short-link'],
  summary: 'Create short link for item',
  description: 'Create short link for item.',

  body: shortLink,
  response: { [StatusCodes.OK]: shortLink, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const updateShortLink = {
  operationId: 'updateShortLink',
  tags: ['short-link'],
  summary: 'Update short link',
  description: 'Update the alias of the short link.',

  params: shortLinkAlias,
  body: shortLinkAlias,
  response: { [StatusCodes.OK]: shortLink, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const deleteShortLink = {
  operationId: 'deleteAlias',
  tags: ['short-link'],
  summary: 'Delete alias',
  description: "Delete short link's alias.",

  params: shortLinkAlias,
  response: { [StatusCodes.OK]: shortLink, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
