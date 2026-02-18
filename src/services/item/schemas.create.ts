import { TObject, TProperties, Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { DocumentItemExtraFlavor, ItemType } from '@graasp/sdk';

import { customType } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
import { geoCoordinateSchemaRef } from './plugins/geolocation/schemas';
import { itemSchema, itemSchemaRef, settingsSchema } from './schemas';

const baseItemCreateSchema = Type.Composite(
  [
    Type.Pick(itemSchema, ['name']),
    Type.Partial(Type.Pick(itemSchema, ['description', 'settings', 'lang'])),
    customType.StrictObject({
      geolocation: Type.Optional(geoCoordinateSchemaRef),
    }),
  ],
  { additionalProperties: false },
);

/**
 * Items' extra field is discriminated by the type field. This function creates a schema for the extra field based on the type field, so `augmentedItemCreateSchema` can be created.
 * @param literal Item type
 * @param extra Extra object associated with the item type
 * @returns The complete item create schema for the item type
 */
function itemCreateSchemaFactory<L extends string, E extends TProperties>(
  literal: L,
  extra: TObject<E>,
) {
  return Type.Composite(
    [
      Type.Omit(baseItemCreateSchema, ['settings']),
      customType.StrictObject({
        type: Type.Literal(literal),
        settings: Type.Optional(settingsSchema),
        extra: Type.Optional(
          customType.StrictObject({ [literal]: extra } as Record<L, TObject<E>>),
        ),
      }),
    ],
    { additionalProperties: false },
  );
}

function itemCreateSchemaFactoryWithSettings<
  L extends string,
  E extends TProperties,
  S extends TProperties,
>(literal: L, extra: TObject<E>, settings: TObject<S>) {
  return Type.Composite(
    [
      Type.Omit(itemCreateSchemaFactory(literal, extra), ['settings']),
      customType.StrictObject({ settings }),
    ],
    { additionalProperties: false },
  );
}

// FOLDER
const folderItemCreateSchema = itemCreateSchemaFactory(
  ItemType.FOLDER,
  customType.StrictObject({}),
);

// APP
const appItemCreateSchema = itemCreateSchemaFactory(
  ItemType.APP,
  customType.StrictObject({ url: Type.String({ format: 'uri' }) }),
);

// DOCUMENT
const documentItemCreateSchema = itemCreateSchemaFactory(
  ItemType.DOCUMENT,
  customType.StrictObject({
    content: Type.String(),
    flavor: Type.Optional(Type.Enum(DocumentItemExtraFlavor)),
    isRaw: Type.Optional(Type.Boolean()),
  }),
);

// LINK
const linkItemCreateSchema = itemCreateSchemaFactoryWithSettings(
  ItemType.LINK,
  customType.StrictObject({
    url: Type.String({ format: 'uri' }),
    thumbnails: Type.Optional(Type.Array(Type.String())),
    icons: Type.Optional(Type.Array(Type.String())),
    html: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
  }),
  Type.Composite(
    [
      settingsSchema,
      customType.StrictObject({
        showLinkIframe: Type.Optional(Type.Boolean()),
        showLinkButton: Type.Optional(Type.Boolean()),
      }),
    ],
    {
      additionalProperties: false,
    },
  ),
);

// FILE
const fileItemExtra = customType.StrictObject({
  name: Type.String(),
});
const localFileItemCreateSchema = itemCreateSchemaFactory(ItemType.LOCAL_FILE, fileItemExtra);
const s3FileItemCreateSchema = itemCreateSchemaFactory(ItemType.S3_FILE, fileItemExtra);

// SHORTCUT
const shortcutItemCreateSchema = itemCreateSchemaFactory(
  ItemType.SHORTCUT,
  customType.StrictObject({ target: customType.UUID() }),
);

export const create = {
  operationId: 'createItem',
  tags: ['item'],
  summary: 'Create item',
  description:
    'Create item, whose possible types are folder, app, document, embeddedLink, localFile, s3File and shortcut.',

  querystring: Type.Partial(
    customType.StrictObject({ parentId: customType.UUID(), previousItemId: customType.UUID() }),
  ),
  body: customType.Discriminable(
    [
      folderItemCreateSchema,
      appItemCreateSchema,
      documentItemCreateSchema,
      linkItemCreateSchema,
      localFileItemCreateSchema,
      s3FileItemCreateSchema,
      shortcutItemCreateSchema,
    ],
    'type',
  ),
  response: { [StatusCodes.OK]: itemSchemaRef, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const createWithThumbnail = {
  operationId: 'createItemWithThumbnail',
  tags: ['item', 'thumbnail'],
  summary: 'Create an item with a thumbnail',
  description: 'Create an item with a thumbnail. The data is sent using a form-data.',

  querystring: Type.Partial(customType.StrictObject({ parentId: customType.UUID() })),
  response: { [StatusCodes.OK]: itemSchemaRef, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
