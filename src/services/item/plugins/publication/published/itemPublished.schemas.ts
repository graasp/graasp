import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { customType, registerSchemaAsRef } from '../../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../../schemas/global';
import { nullableMemberSchemaRef } from '../../../../member/member.schemas';
import { genericItemSchemaRef } from '../../../common.schemas';
import { packedItemSchemaRef } from '../../../item.schemas.packed';

const publishEntrySchema = customType.StrictObject(
  {
    id: customType.UUID(),
    item: genericItemSchemaRef,
    creator: nullableMemberSchemaRef,
    createdAt: customType.DateTime(),
  },
  {
    description: 'Information of a published item',
  },
);

registerSchemaAsRef('itemPublished', 'Item Published', publishEntrySchema);

export const getCollectionsForMember = {
  operationId: 'getCollectionsForMember',
  tags: ['collection'],
  summary: 'Get collections for member',
  description: 'Get packed collections for member, used in the builder view of the member.',

  params: customType.StrictObject({
    memberId: customType.UUID(),
  }),

  response: {
    [StatusCodes.OK]: Type.Array(packedItemSchemaRef),
    '4xx': errorSchemaRef,
  },
};

export const publishItem = {
  operationId: 'publishItem',
  tags: ['collection'],
  summary: 'Publish an item',
  description: 'Publish an item. It will become listed in the Library.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
    '4xx': errorSchemaRef,
  },
};

export const unpublishItem = {
  operationId: 'unpublishItem',
  tags: ['collection'],
  summary: 'Unpublish an item',
  description: 'Unpublish an item. It will stop being available in the Library.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
    '4xx': errorSchemaRef,
  },
};

export const getInformations = {
  operationId: 'getCollectionInformations',
  tags: ['collection'],
  summary: 'Get information of a collection',
  description: 'Get information of a collection, including views count.',

  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: customType.Nullable(
      Type.Composite([publishEntrySchema, customType.StrictObject({ totalViews: Type.Number() })]),
    ),
    '4xx': errorSchemaRef,
  },
};
