import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { DocumentItemExtraFlavor } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemSchema } from '../../item.schemas';
import { geoCoordinateSchemaRef } from '../geolocation/itemGeolocation.schemas';

export const documentSchema = Type.Composite(
  [
    itemSchema,
    customType.StrictObject({
      extra: customType.StrictObject({
        document: customType.StrictObject({
          content: Type.String({ minLength: 1 }),
          flavor: Type.Optional(
            Type.Union([
              Type.Enum(DocumentItemExtraFlavor),
              ...Object.values(DocumentItemExtraFlavor).map((f) => Type.Literal(f.toString())),
            ]),
          ),
          isRaw: Type.Optional(Type.Boolean()),
        }),
      }),
    }),
  ],
  {
    title: 'Document',
    description: 'Item of type document, represents a text.',
  },
);

export const createDocument = {
  operationId: 'createDocument',
  tags: ['item', 'document'],
  summary: 'Create document',
  description: 'Create document with given payload. The content will be sanitized.',

  querystring: Type.Partial(
    customType.StrictObject({ parentId: customType.UUID(), previousItemId: customType.UUID() }),
  ),
  body: Type.Composite(
    [
      Type.Pick(itemSchema, ['name']),
      Type.Partial(Type.Pick(itemSchema, ['description', 'lang', 'settings'])),
      customType.StrictObject({
        content: Type.String({ minLength: 1 }),
        flavor: Type.Optional(Type.Union([Type.Enum(DocumentItemExtraFlavor)])),
        isRaw: Type.Optional(Type.Boolean()),
      }),

      customType.StrictObject({
        geolocation: Type.Optional(geoCoordinateSchemaRef),
      }),
    ],
    { additionalProperties: false },
  ),
  response: { [StatusCodes.OK]: documentSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const updateDocument = {
  operationId: 'updateDocument',
  tags: ['item'],
  summary: 'Update document',
  description: 'Update document given payload. The content will be sanitized.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: Type.Partial(
    Type.Composite([
      Type.Pick(documentSchema, ['name', 'description', 'lang', 'settings']),
      customType.StrictObject({
        content: Type.String({ minLength: 1 }),
        flavor: Type.Optional(Type.Union([Type.Enum(DocumentItemExtraFlavor)])),
        isRaw: Type.Optional(Type.Boolean()),
      }),
    ]),
    { minProperties: 1 },
  ),
  response: { [StatusCodes.OK]: documentSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
