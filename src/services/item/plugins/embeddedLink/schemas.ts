import { Type } from '@sinclair/typebox';
import { S } from 'fluent-json-schema';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { ItemType } from '@graasp/sdk';

import { errorSchemaRef } from '../../../../schemas/global';

// on link creation or update, the only allowed property in extra is the "url" property.
// all other extra properties are filled by the backend.
const strictUrlProperty = S.object()
  .additionalProperties(false)
  .prop('url', S.string().format('uri-reference'))
  .required(['url']);

// schema defining the properties that can be supplied on the "extra" for the link item on creation
const embeddedLinkItemExtraCreate = S.object()
  .additionalProperties(false)
  .prop(ItemType.LINK, strictUrlProperty)
  .required([ItemType.LINK]);

// schema upgrading the general item creation schema, specifying the link properties allowed on creation
export const createSchema = S.object()
  .prop('type', S.const(ItemType.LINK))
  .prop('extra', embeddedLinkItemExtraCreate)
  .required(['type', 'extra']);

// schema defining the properties that can be supplied on the "extra" for the link item on update
export const updateExtraSchema = S.object()
  .additionalProperties(false)
  .prop(ItemType.LINK, strictUrlProperty)
  .required([ItemType.LINK]);

export const getLinkMetadata = {
  querystring: Type.Partial(
    Type.Object(
      { link: Type.String({ format: 'uri-reference' }) },
      { additionalProperties: false },
    ),
  ),
  response: {
    [StatusCodes.OK]: Type.Object(
      {
        title: Type.Optional(Type.String()),
        description: Type.Optional(Type.String()),
        html: Type.Optional(Type.String()),
        isEmbeddingAllowed: Type.Boolean(),
        icons: Type.Array(Type.String()),
        thumbnails: Type.Array(Type.String()),
      },
      { additionalProperties: false },
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
