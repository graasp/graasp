import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { ItemVisibilityType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { nullableMemberSchemaRef } from '../../../member/member.schemas';

export const itemVisibilitySchemaRef = registerSchemaAsRef(
  'itemVisibility',
  'Item Visibility',
  customType.StrictObject(
    {
      id: customType.UUID(),
      type: customType.EnumString(Object.values(ItemVisibilityType)),
      itemPath: Type.String(),
      creator: Type.Optional(nullableMemberSchemaRef),
      createdAt: customType.DateTime(),
    },
    {
      description: 'Visibility attached to an item and its descendants.',
    },
  ),
);

// schema for creating an item visibility
const create = {
  operationId: 'createVisibility',
  tags: ['visibility'],
  summary: 'Create visibility on item',
  description:
    'Create visibility on item with given visibility that will apply on itself and its descendants.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
    type: customType.EnumString(Object.values(ItemVisibilityType)),
  }),
  response: {
    [StatusCodes.CREATED]: customType.StrictObject(
      {
        id: customType.UUID(),
        type: customType.EnumString(Object.values(ItemVisibilityType)),
        item: Type.Object({ path: Type.String() }),
        creator: Type.Optional(nullableMemberSchemaRef),
        createdAt: customType.DateTime(),
      },
      {
        description: 'Successful Response',
      },
    ),
    '4xx': errorSchemaRef,
  },
};

// schema for deleting an item visibility
const deleteOne = {
  operationId: 'deleteVisibility',
  tags: ['visibility'],
  summary: 'Delete visibility of item',
  description: 'Delete visibility of item with given type.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
    type: customType.EnumString(Object.values(ItemVisibilityType)),
  }),
  response: {
    [StatusCodes.OK]: Type.Object(
      { item: Type.Object({ path: Type.String() }) },
      {
        description: 'Successful Response',
      },
    ),
    '4xx': errorSchemaRef,
  },
};

export { create, deleteOne };
