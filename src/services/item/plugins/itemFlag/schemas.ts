import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FlagType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { itemIdSchemaRef, itemSchemaRef } from '../../schema';

export const itemFlagSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object definition
      id: customType.UUID(),
      item: itemSchemaRef,
      type: Type.Enum(FlagType),
      creator: Type.Ref('https://graasp.org/members/#/definitions/member'),
      createdAt: customType.DateTime(),
    },
    {
      // Schema options
      title: 'Item Flag',
      $id: 'itemFlag',
      additionalProperties: false,
    },
  ),
);

export const createItemFlagSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object definition
      type: Type.Enum(FlagType),
    },
    {
      // Schema options
      title: 'Create Flag',
      $id: 'createFlag',
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
