import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { itemCommonSchema } from '../../common.schemas';

const shortcutSchema = Type.Composite([
  itemCommonSchema,
  customType.StrictObject(
    {
      type: Type.Literal('shortcut'),
      extra: customType.StrictObject({
        shortcut: customType.StrictObject({
          target: customType.UUID(),
        }),
      }),
    },
    {
      title: 'Shortcut',
      description: 'Item of type shortcut, link to another item.',
    },
  ),
]);

export const shortcutItemSchemaRef = registerSchemaAsRef(
  'shortcutItem',
  'Shortcut Item',
  shortcutSchema,
);

export const createShortcut = {
  operationId: 'createShortcut',
  tags: ['item', 'shortcut'],
  summary: 'Create shortcut',
  description:
    "Create shortcut. If not provided, the name of the shortcut is infered from the actor's language.",

  querystring: Type.Partial(
    customType.StrictObject({ parentId: customType.UUID(), previousItemId: customType.UUID() }),
  ),
  body: Type.Composite([
    customType.StrictObject({
      target: customType.UUID(),
    }),
    Type.Partial(Type.Pick(shortcutSchema, ['name', 'description'])),
  ]),
  response: { [StatusCodes.OK]: shortcutSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;

export const updateShortcut = {
  operationId: 'updateShortcut',
  tags: ['item'],
  summary: 'Update shortcut',
  description: 'Update shortcut given body.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: Type.Partial(Type.Pick(shortcutSchema, ['name', 'description']), {
    minProperties: 1,
  }),
  response: { [StatusCodes.OK]: shortcutSchema, '4xx': errorSchemaRef },
} as const satisfies FastifySchema;
