import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../schemas/global';
import { genericItemSchemaRef } from '../../../common.schemas';

const itemValidationGroupSchema = customType.StrictObject(
  {
    id: customType.UUID(),
    item: genericItemSchemaRef,
    createdAt: customType.DateTime(),
    itemValidations: Type.Array(
      customType.StrictObject({
        id: customType.UUID(),
        process: customType.EnumString(Object.values(ItemValidationProcess)),
        status: customType.EnumString(Object.values(ItemValidationStatus)),
        result: customType.Nullable(Type.String()),
        createdAt: customType.DateTime(),
        updatedAt: customType.DateTime(),
      }),
    ),
  },
  {
    description: 'Group of validations for an item, without nested item',
  },
);

registerSchemaAsRef('itemValidationGroup', 'Item Validation Group', itemValidationGroupSchema);

export const getLatestItemValidationGroup = {
  operationId: 'getLatestItemValidationGroup',
  tags: ['collection', 'validation'],
  summary: 'Get latest validation information.',
  description: `Get latest validation information. Returns null if no validation has been performed before.`,

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: customType.Nullable(itemValidationGroupSchema),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const validateItem = {
  operationId: 'validateItem',
  tags: ['collection', 'validation'],
  summary: 'Validate item',
  description: `Validate item's tree against many processes, such as nudity detection.`,

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.ACCEPTED]: customType.UUID({ description: 'Item being validated' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
