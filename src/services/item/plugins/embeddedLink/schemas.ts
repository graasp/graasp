import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemSchema } from '../../schemas';
import { geoCoordinateSchemaRef } from '../geolocation/schemas';

export const embeddedLinkSchema = Type.Composite([
  itemSchema,
  customType.StrictObject(
    {
      extra: customType.StrictObject({
        embeddedLink: customType.StrictObject({
          url: Type.String({ format: 'uri' }),
        }),
      }),
      settings: customType.StrictObject({
        showLinkIframe: Type.Optional(Type.Boolean()),
        showLinkButton: Type.Optional(Type.Boolean()),
      }),
    },
    {
      title: 'Embedded Link',
      description: 'Item of type embedded link, represents a resource to an external website.',
    },
  ),
]);

export const getLinkMetadata = {
  operationId: 'getLinkMetadata',
  tags: ['item', 'link'],
  summary: 'Get metadata information from iframely for given url',
  description: 'Get metadata information from iframely for given url.',

  querystring: Type.Partial(
    customType.StrictObject({ link: Type.String({ format: 'uri-reference' }) }),
  ),
  response: {
    [StatusCodes.OK]: customType.StrictObject({
      title: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
      html: Type.Optional(Type.String()),
      isEmbeddingAllowed: Type.Boolean(),
      icons: Type.Array(Type.String()),
      thumbnails: Type.Array(Type.String()),
    }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const createLink = {
  operationId: 'createLink',
  tags: ['item', 'link'],
  summary: 'Create link',
  description: 'Create link.',

  querystring: Type.Partial(
    customType.StrictObject({ parentId: customType.UUID(), previousItemId: customType.UUID() }),
  ),
  body: Type.Composite([
    customType.StrictObject({ url: Type.String({ format: 'uri' }) }),
    Type.Pick(embeddedLinkSchema, ['name']),
    Type.Partial(Type.Pick(embeddedLinkSchema, ['description', 'lang', 'settings'])),
    customType.StrictObject({
      geolocation: Type.Optional(geoCoordinateSchemaRef),
    }),
  ]),
  response: { [StatusCodes.OK]: embeddedLinkSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const updateLink = {
  operationId: 'updateLink',
  tags: ['item'],
  summary: 'Update link',
  description: 'Update link given body.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: Type.Partial(
    Type.Composite([
      Type.Pick(embeddedLinkSchema, ['name', 'description', 'lang', 'settings']),
      customType.StrictObject({ url: Type.String() }),
    ]),
    { minProperties: 1 },
  ),
  response: { [StatusCodes.OK]: embeddedLinkSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
