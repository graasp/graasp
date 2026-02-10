import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemCommonSchema, settingsSchema } from '../../common.schemas';
import { geoCoordinateSchemaRef } from '../geolocation/itemGeolocation.schemas';

const linkSettingsSchema = customType.StrictObject({
  showLinkIframe: Type.Optional(Type.Boolean()),
  showLinkButton: Type.Optional(Type.Boolean()),
});

const linkItemSchema = Type.Composite(
  [
    itemCommonSchema,
    customType.StrictObject({
      type: Type.Literal('embeddedLink'),
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
    }),
    customType.StrictObject({
      settings: Type.Composite([settingsSchema, linkSettingsSchema]),
    }),
  ],
  {
    title: 'Embedded Link',
    description: 'Item of type embedded link, represents a resource to an external website.',
  },
);

export const embeddedLinkItemSchemaRef = registerSchemaAsRef(
  'embeddedLinkItem',
  'Embedded Link Item',
  linkItemSchema,
);

export const getLinkMetadata = {
  operationId: 'getLinkMetadata',
  tags: ['item', 'link'],
  summary: 'Get metadata information from iframely for given url',
  description: 'Get metadata information from iframely for given url.',

  querystring: customType.StrictObject({ link: Type.String({ format: 'uri-reference' }) }),

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
    Type.Pick(linkItemSchema, ['name']),
    Type.Partial(Type.Pick(linkItemSchema, ['description', 'lang'])),

    // link flat config
    // uri is stricter than uri-reference
    customType.StrictObject({ url: Type.String({ format: 'uri' }) }),

    customType.StrictObject({
      geolocation: Type.Optional(geoCoordinateSchemaRef),
    }),
  ]),
  response: { [StatusCodes.OK]: embeddedLinkItemSchemaRef, '4xx': errorSchemaRef },
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
    Type.Composite(
      [
        Type.Pick(linkItemSchema, ['name', 'description', 'lang', 'settings']),

        // flat config for links
        customType.StrictObject({ url: Type.String({ format: 'uri' }) }),
        linkSettingsSchema,
      ],
      { additionalProperties: false },
    ),
    { minProperties: 1 },
  ),
  response: { [StatusCodes.OK]: embeddedLinkItemSchemaRef, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
