import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { ThumbnailSize } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox.js';
import { errorSchemaRef } from '../../../../schemas/global.js';

export const upload = {
  response: { [StatusCodes.NO_CONTENT]: Type.Null() },
} as const satisfies FastifySchema;

export const download = {
  operationId: 'downloadAvatar',
  tags: ['member', 'avatar'],
  summary: "Get a member's avatar",
  description:
    "Get a member's avatar at given size. The return value is empty if the member did not previously uploaded an avatar. Since guests don't have avatars, the return value will also be empty.",

  params: customType.StrictObject({
    id: customType.UUID(),
    size: Type.Enum(ThumbnailSize, { default: ThumbnailSize.Medium }),
  }),
  querystring: customType.StrictObject({
    /**
     * @deprecated we don't use this parameter anymore. This should be removed once the mobile app is deprecated.
     */
    replyUrl: Type.Boolean({ default: true, deprecated: true }),
  }),
  response: {
    [StatusCodes.OK]: Type.String({ description: 'Url string of the avatar' }),
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'No avatar' }),
    '4xx': errorSchemaRef,
    [StatusCodes.INTERNAL_SERVER_ERROR]: errorSchemaRef,
  },
} as const satisfies FastifySchema;
