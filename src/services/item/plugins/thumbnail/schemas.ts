import { Type } from '@sinclair/typebox';

import { FastifySchema } from 'fastify';

import { ThumbnailSize } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';

export const upload = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
} as const satisfies FastifySchema;

export const download = {
  params: customType.StrictObject({
    // Object Definition
    id: customType.UUID(),
    size: Type.Enum(ThumbnailSize, { default: ThumbnailSize.Medium }),
  }),
  querystring: customType.StrictObject({
    replyUrl: Type.Boolean({ default: false }),
  }),
} as const satisfies FastifySchema;

export const deleteSchema = {
  params: customType.StrictObject({
    id: customType.UUID(),
  }),
} as const satisfies FastifySchema;
