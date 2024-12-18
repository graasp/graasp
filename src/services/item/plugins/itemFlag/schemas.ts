import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FlagType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { nullableAccountSchemaRef } from '../../../account/schemas';
import { itemSchemaRef } from '../../schemas';

export const itemFlagSchemaRef = registerSchemaAsRef(
  'itemFlag',
  'Item Flag',
  customType.StrictObject(
    {
      id: customType.UUID(),
      item: itemSchemaRef,
      type: Type.Enum(FlagType),
      creator: nullableAccountSchemaRef,
      createdAt: customType.DateTime(),
    },
    {
      description: 'Flag object of an item.',
    },
  ),
);

// schema for creating an item flag
const create = {
  operationId: 'createItemFlag',
  tags: ['flag'],
  summary: 'Flag item',
  description: 'Flag item with given type.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  body: customType.StrictObject({
    type: Type.Enum(FlagType),
  }),
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
