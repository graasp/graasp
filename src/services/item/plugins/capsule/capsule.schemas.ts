import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { folderSchema } from '../folder/folder.schemas';
import { geoCoordinateSchemaRef } from '../geolocation/itemGeolocation.schemas';

const capsuleSchema = folderSchema;

export const createCapsule = {
  operationId: 'createFolder',
  tags: ['item', 'capsule'],
  summary: 'Create capsule',
  description: 'Create capsule.',

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
  response: { [StatusCodes.OK]: capsuleSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const switchCapsuleToFolder = {
  operationId: 'switchCapsuleToFolder',
  tags: ['item'],
  summary: 'Switch capsule item to folder',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: { [StatusCodes.OK]: capsuleSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
