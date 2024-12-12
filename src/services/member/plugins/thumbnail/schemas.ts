import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { ThumbnailSize } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

export const upload = {
  response: { [StatusCodes.NO_CONTENT]: Type.Null() },
} as const satisfies FastifySchema;

export const download = {
  operationId: 'downloadAvatar',
  tags: ['member', 'avatar'],
  summary: "Get a member's avatar",
  description:
    "Get a member's avatar. The return value is empty if the member did not previously uploaded an avatar. Since guests don't have avatars, the return value will also be empty.",

  params: customType.StrictObject({
    id: customType.UUID(),
    size: Type.Enum(ThumbnailSize, { default: ThumbnailSize.Medium }),
  }),
  querystring: customType.StrictObject({
    replyUrl: Type.Boolean({ default: false }),
  }),
  response: {
    [StatusCodes.OK]: Type.String({ description: 'Url string of the avatar if replyUrl is true' }),
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'No avatar' }),
    '4xx': errorSchemaRef,
    [StatusCodes.INTERNAL_SERVER_ERROR]: errorSchemaRef,
  },
} as const satisfies FastifySchema;
