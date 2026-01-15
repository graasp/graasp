import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { folderSchema } from '../folder/folder.schemas';

// For now a capsule is a folder with one different setting
const capsuleSchema = folderSchema;

export const createCapsule = {
  operationId: 'createCapsule',
  tags: ['item', 'capsule'],
  summary: 'Create capsule',
  description: 'Create capsule.',

  querystring: Type.Partial(
    customType.StrictObject({ parentId: customType.UUID(), previousItemId: customType.UUID() }),
  ),
  body: Type.Composite([
    Type.Pick(capsuleSchema, ['name']),
    Type.Partial(Type.Pick(capsuleSchema, ['description', 'lang', 'settings'])),
  ]),
  response: { [StatusCodes.OK]: capsuleSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const convertCapsuleToFolder = {
  operationId: 'convertCapsuleToFolder',
  tags: ['item', 'capsule'],
  summary: 'Switch capsule item to folder',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: { [StatusCodes.OK]: capsuleSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
