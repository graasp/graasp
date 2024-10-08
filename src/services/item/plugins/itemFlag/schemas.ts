import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FlagType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { nullableMemberSchemaRef } from '../../../member/schemas';
import { itemIdSchemaRef, itemSchemaRef } from '../../schema';

export const itemFlagSchemaRef = registerSchemaAsRef(
  'itemFlag',
  'Item Flag',
  Type.Object(
    {
      // Object definition
      id: customType.UUID(),
      item: itemSchemaRef,
      type: Type.Enum(FlagType),
      creator: nullableMemberSchemaRef,
      createdAt: customType.DateTime(),
    },
    {
      // Schema options
      additionalProperties: false,
    },
  ),
);

export const createItemFlagSchemaRef = registerSchemaAsRef(
  'createFlag',
  'Create Flag',
  Type.Object(
    {
      // Object definition
      type: Type.Enum(FlagType),
    },
    {
      // Schema options
      additionalProperties: false,
    },
  ),
);

// schema for creating an item flag
const create = {
  params: itemIdSchemaRef,
  body: createItemFlagSchemaRef,
  response: {
    [StatusCodes.CREATED]: itemFlagSchemaRef,
  },
};

// schema for getting flag types
const getFlagTypes = {
  response: {
    [StatusCodes.OK]: Type.Array(Type.Enum(FlagType)),
  },
};

export { create, getFlagTypes };
