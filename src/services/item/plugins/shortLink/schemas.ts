import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { ShortLinkPlatform } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

const shortLinkPayloadFlatten = customType.StrictObject({
  itemId: customType.UUID(),
  alias: Type.String({ minLength: 6, maxLength: 255, pattern: '^[a-zA-Z0-9-]*$' }),
  platform: Type.Enum(ShortLinkPlatform),
});

const shortLinkPayload = Type.Pick(shortLinkPayloadFlatten, ['alias', 'platform']);

export const getRedirection = {
  operationId: 'getShortLinkRedirection',
  tags: ['shortLink'],
  summary: 'Get redirection for short link',
  description: 'Get redirection for given short link.',

  params: Type.Pick(shortLinkPayloadFlatten, ['alias']),
  response: { [StatusCodes.MOVED_TEMPORARILY]: shortLinkPayload, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const getAvailable = {
  operationId: 'getShortLinkAvailability',
  tags: ['shortLink'],
  summary: 'Get whether an alias is available',
  description: 'Get whether an alias is available.',

  params: Type.Pick(shortLinkPayloadFlatten, ['alias']),
  response: {
    [StatusCodes.OK]: Type.Object({ available: Type.Boolean() }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getAllByItem = {
  operationId: 'getShortLinksForItem',
  tags: ['shortLink'],
  summary: 'Get all short links for item',
  description: 'Get all short links information for item.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: { [StatusCodes.OK]: Type.Array(shortLinkPayload), '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const create = {
  operationId: 'createShortLink',
  tags: ['shortLink'],
  summary: 'Create short link for item',
  description: 'Create short link for item.',

  body: shortLinkPayloadFlatten,
  response: { [StatusCodes.OK]: shortLinkPayload, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const update = {
  operationId: 'updateShortLink',
  tags: ['shortLink'],
  summary: 'Update short link',
  description: 'Update short link for item, given alias and platform.',

  params: Type.Pick(shortLinkPayloadFlatten, ['alias']),
  body: Type.Union([
    Type.Pick(shortLinkPayload, ['alias']),
    Type.Pick(shortLinkPayload, ['platform']),
  ]),
  response: { [StatusCodes.OK]: shortLinkPayload, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const deleteAlias = {
  operationId: 'deleteAlias',
  tags: ['shortLink'],
  summary: 'Delete alias',
  description: "Delete short link's alias.",

  params: Type.Pick(shortLinkPayloadFlatten, ['alias']),
  response: { [StatusCodes.OK]: shortLinkPayload, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const getRestricted = {
  params: Type.Pick(shortLinkPayloadFlatten, ['alias']),
  response: {
    [StatusCodes.OK]: Type.Composite(
      [shortLinkPayload, Type.Object({ createdAt: customType.DateTime() })],
      {
        additionalProperties: false,
      },
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
