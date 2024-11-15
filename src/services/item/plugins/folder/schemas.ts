import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemSchema } from '../../schemas';
import { geoCoordinateSchemaRef } from '../geolocation/schemas';

export const folderSchema = Type.Composite([
  itemSchema,
  customType.StrictObject(
    {
      extra: customType.StrictObject({
        folder: customType.StrictObject({
          isRoot: Type.Optional(Type.Boolean()),
        }),
      }),
    },
    {
      title: 'Folder',
      description: 'Item of type folder, can contain other items and maintain an order.',
    },
  ),
]);

export const createFolder = {
  operationId: 'createFolder',
  tags: ['item', 'folder'],
  summary: 'Create folder',
  description: 'Create folder.',

  querystring: Type.Partial(
    customType.StrictObject({ parentId: customType.UUID(), previousItemId: customType.UUID() }),
  ),
  body: Type.Composite([
    Type.Pick(folderSchema, ['name']),
    Type.Partial(Type.Pick(folderSchema, ['description', 'lang', 'settings'])),
    customType.StrictObject({
      geolocation: Type.Optional(geoCoordinateSchemaRef),
    }),
  ]),
  response: { [StatusCodes.OK]: folderSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const createFolderWithThumbnail = {
  operationId: 'createItemWithThumbnail',
  tags: ['item', 'thumbnail'],
  summary: 'Create an item with a thumbnail',
  description: 'Create an item with a thumbnail. The data is sent using a form-data.',

  querystring: Type.Partial(customType.StrictObject({ parentId: customType.UUID() })),
  response: { [StatusCodes.OK]: folderSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const updateFolder = {
  operationId: 'updateFolder',
  tags: ['item'],
  summary: 'Update folder',
  description: 'Update folder given body.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: Type.Partial(Type.Pick(folderSchema, ['name', 'description', 'lang', 'settings']), {
    minProperties: 1,
  }),
  response: { [StatusCodes.OK]: folderSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
