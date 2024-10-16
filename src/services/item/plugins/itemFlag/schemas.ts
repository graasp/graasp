import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FlagType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { nullableAccountSchemaRef } from '../../../account/schemas';
import { itemIdSchemaRef, itemSchemaRef } from '../../schemas';

export const itemFlagSchemaRef = registerSchemaAsRef(
  'itemFlag',
  'Item Flag',
  Type.Object(
    {
      // Object definition
      id: customType.UUID(),
      item: itemSchemaRef,
      type: Type.Enum(FlagType),
      creator: nullableAccountSchemaRef,
      createdAt: customType.DateTime(),
    },
    {
      // Schema options
      description: 'Flag object of an item.',
      additionalProperties: false,
    },
  ),
);

// schema for creating an item flag
const create = {
  operationId: 'createItemFlag',
  tags: ['flag'],
  summary: 'Flag item',
  description: 'Flag item with given type.',

  params: itemIdSchemaRef,
  body: Type.Object(
    {
      // Object definition
      type: Type.Enum(FlagType),
    },
    {
      // Schema options
      additionalProperties: false,
    },
  ),
  response: {
    [StatusCodes.CREATED]: itemFlagSchemaRef,
    '4xx': errorSchemaRef,
  },
};

// schema for getting flag types
const getFlagTypes = {
  operationId: 'getFlagTypes',
  tags: ['flag'],
  summary: 'Get flag types',
  description: 'Get available flag types.',

  response: {
    [StatusCodes.OK]: Type.Array(Type.Enum(FlagType), { description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
};

export { create, getFlagTypes };
