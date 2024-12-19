import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemSchema } from '../../schemas';
import { geoCoordinateSchemaRef } from '../geolocation/schemas';

const linkSettingsSchema = customType.StrictObject({
  showLinkIframe: Type.Optional(Type.Boolean()),
  showLinkButton: Type.Optional(Type.Boolean()),
});

export const embeddedLinkSchema = Type.Composite(
  [
    itemSchema,
    customType.StrictObject({
      extra: customType.StrictObject({
        embeddedLink: customType.StrictObject({
          url: Type.String({ format: 'uri' }),
          thumbnails: Type.Optional(Type.Array(Type.String())),
          icons: Type.Optional(Type.Array(Type.String())),
          html: Type.Optional(Type.String()),
          description: Type.Optional(Type.String()),
          title: Type.Optional(Type.String()),
        }),
      }),
      settings: linkSettingsSchema,
    }),
  ],
  {
    title: 'Embedded Link',
    description: 'Item of type embedded link, represents a resource to an external website.',
  },
);

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
    Type.Pick(itemSchema, ['name']),
    Type.Partial(Type.Pick(itemSchema, ['description', 'lang', 'settings'])),

    // link flat config
    customType.StrictObject({ url: Type.String({ format: 'uri' }) }),
    linkSettingsSchema,

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

      // flat config for links
      customType.StrictObject({ url: Type.String({ format: 'uri' }) }),
      linkSettingsSchema,
    ]),
    { minProperties: 1 },
  ),
  response: { [StatusCodes.OK]: embeddedLinkSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
