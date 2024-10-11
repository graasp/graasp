import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { ShortLinkPlatform } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { itemIdSchemaRef } from '../../schema';

const shortLinkPayloadFlatten = Type.Object(
  {
    itemId: customType.UUID(),
    alias: Type.String({ minLength: 6, maxLength: 255, pattern: '^[a-zA-Z0-9-]*$' }),
    platform: Type.Enum(ShortLinkPlatform),
  },
  {
    additionalProperties: false,
  },
);

const shortLinkPayload = Type.Pick(shortLinkPayloadFlatten, ['alias', 'platform']);

export const getRedirection = {
  params: Type.Pick(shortLinkPayloadFlatten, ['alias']),
  response: { [StatusCodes.OK]: shortLinkPayload },
} as const satisfies FastifySchema;

export const getAvailable = {
  params: Type.Pick(shortLinkPayloadFlatten, ['alias']),
  response: {
    [StatusCodes.OK]: Type.Object({ available: Type.Boolean() }),
  },
} as const satisfies FastifySchema;

export const getAllByItem = {
  params: itemIdSchemaRef,
  response: { [StatusCodes.OK]: Type.Array(shortLinkPayload) },
} as const satisfies FastifySchema;

export const create = {
  body: shortLinkPayloadFlatten,
  response: { [StatusCodes.OK]: shortLinkPayload },
} as const satisfies FastifySchema;

export const update = {
  params: Type.Pick(shortLinkPayloadFlatten, ['alias']),
  body: Type.Union([
    Type.Pick(shortLinkPayload, ['alias']),
    Type.Pick(shortLinkPayload, ['platform']),
  ]),
  response: { [StatusCodes.OK]: shortLinkPayload },
} as const satisfies FastifySchema;

export const deleteAlias = {
  params: Type.Pick(shortLinkPayloadFlatten, ['alias']),
  response: { [StatusCodes.OK]: shortLinkPayload },
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
  },
} as const satisfies FastifySchema;
