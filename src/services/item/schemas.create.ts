import { TObject, TProperties, Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { DocumentItemExtraFlavor, ItemType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { errorSchemaRef } from '../../schemas/global';
import { geoCoordinateSchemaRef } from './plugins/geolocation/schemas';
import { itemSchema, itemSchemaRef, settingsSchema } from './schemas';

const baseItemCreateSchema = Type.Composite(
  [
    Type.Pick(itemSchema, ['name']),
    Type.Partial(Type.Pick(itemSchema, ['displayName', 'description', 'settings', 'lang'])),
    Type.Object(
      {
        geolocation: geoCoordinateSchemaRef,
      },
      { additionalProperties: false },
    ),
  ],
  { additionalProperties: false },
);

/**
 * Items' extra field is discriminated by the type field. This function creates a schema for the extra field based on the type field, so the `augmentedItemCreateSchemaRef` can be created.
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
      Type.Object(
        {
          type: Type.Literal(literal),
          settings: Type.Optional(settingsSchema),
          extra: Type.Optional(
            Type.Object({ [literal]: extra } as Record<L, TObject<E>>, {
              additionalProperties: false,
            }),
          ),
        },
        { additionalProperties: false },
      ),
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
      Type.Object({ settings }, { additionalProperties: false }),
    ],
    { additionalProperties: false },
  );
}

const emptyExtra = Type.Object({}, { additionalProperties: false });
const fileItemExtra = Type.Object(
  {
    name: Type.String(),
  },
  { additionalProperties: false },
);
const folderItemCreateSchema = itemCreateSchemaFactory(ItemType.FOLDER, emptyExtra);
const appItemCreateSchema = itemCreateSchemaFactory(
  ItemType.APP,
  Type.Object({ url: Type.String({ format: 'uri' }) }, { additionalProperties: false }),
);
const documentItemCreateSchema = itemCreateSchemaFactory(
  ItemType.DOCUMENT,
  Type.Object(
    {
      content: Type.String(),
      flavor: Type.Optional(Type.Enum(DocumentItemExtraFlavor)),
      isRaw: Type.Optional(Type.Boolean()),
    },
    { additionalProperties: false },
  ),
);
const linkItemCreateSchema = itemCreateSchemaFactoryWithSettings(
  ItemType.LINK,
  Type.Object(
    {
      url: Type.String({ format: 'uri' }),
      thumbnails: Type.Optional(Type.Array(Type.String())),
      icons: Type.Optional(Type.Array(Type.String())),
      html: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
    },
    { additionalProperties: false },
  ),
  Type.Composite(
    [
      settingsSchema,
      Type.Object(
        {
          showLinkIframe: Type.Optional(Type.Boolean()),
          showLinkButton: Type.Optional(Type.Boolean()),
        },
        { additionalProperties: false },
      ),
    ],
    {
      additionalProperties: false,
    },
  ),
);
const localFileItemCreateSchema = itemCreateSchemaFactory(ItemType.LOCAL_FILE, fileItemExtra);
const s3FileItemCreateSchema = itemCreateSchemaFactory(ItemType.S3_FILE, fileItemExtra);
const etherpadItemCreateSchema = itemCreateSchemaFactory(
  ItemType.ETHERPAD,
  Type.Object({ groupID: Type.String(), padID: Type.String() }, { additionalProperties: false }),
);
const h5pItemCreateSchema = itemCreateSchemaFactory(
  ItemType.H5P,
  Type.Object(
    { contentId: Type.String(), h5pFilePath: Type.String(), contentFilePath: Type.String() },
    { additionalProperties: false },
  ),
);
const shortcutItemCreateSchema = itemCreateSchemaFactory(
  ItemType.SHORTCUT,
  Type.Object({ target: customType.UUID() }, { additionalProperties: false }),
);

export const augmentedItemCreateSchemaRef = registerSchemaAsRef(
  'augmentedItemCreate',
  'Augmented Item Create',
  customType.Discriminable(
    [
      folderItemCreateSchema,
      appItemCreateSchema,
      documentItemCreateSchema,
      linkItemCreateSchema,
      localFileItemCreateSchema,
      s3FileItemCreateSchema,
      etherpadItemCreateSchema,
      h5pItemCreateSchema,
      shortcutItemCreateSchema,
    ],
    'type',
  ),
);

export const create = {
  querystring: Type.Partial(
    Type.Object(
      { parentId: customType.UUID(), previousItemId: customType.UUID() },
      { additionalProperties: false },
    ),
  ),
  body: augmentedItemCreateSchemaRef,
  response: { [StatusCodes.OK]: itemSchemaRef, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
