import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { MembershipRequestStatus } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { genericItemSchemaRef } from '../../../item/common.schemas';

const completeMembershipRequestSchema = customType.StrictObject({
  member: customType.StrictObject({
    id: customType.UUID(),
    name: customType.Username(),
    email: Type.String({ format: 'email' }),
  }),
  item: genericItemSchemaRef,
  createdAt: customType.DateTime(),
});

export const completeMembershipRequestSchemaRef = registerSchemaAsRef(
  'completeMembershipRequest',
  'Complete Membership Request',
  completeMembershipRequestSchema,
);

export const simpleMembershipRequestSchemaRef = registerSchemaAsRef(
  'simpleMembershipRequest',
  'Simple Membership Request',
  Type.Pick(completeMembershipRequestSchema, ['member', 'createdAt']),
);

export const getAllByItem = {
  operationId: 'getMembershipRequestsByItemId',
  tags: ['membership-request'],
  summary: 'Get all membership requests for an item',
  description: 'Get all membership requests with member information for an item by its ID',
  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(simpleMembershipRequestSchemaRef, {
      uniqueItems: true,
    }),
  },
} as const satisfies FastifySchema;

export const createOne = {
  operationId: 'createMembershipRequest',
  tags: ['membership-request'],
  summary: 'Create a membership request',
  description: `Create a membership request for an item with the authenticated member.
  The member should not have any permission on the item.
  If there is an Item Login associated with the item, the request will be rejected.`,
  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
  },
} as const satisfies FastifySchema;

export const getOwn = {
  operationId: 'getOwnMembershipRequestByItemId',
  tags: ['membership-request'],
  summary: 'Get the status of the membership request for the authenticated member',
  description:
    'Get the status of the membership request for the authenticated member for an item by its ID',
  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: customType.StrictObject({
      status: Type.Enum(MembershipRequestStatus),
    }),
  },
} as const satisfies FastifySchema;

export const deleteOne = {
  operationId: 'deleteMembershipRequest',
  tags: ['membership-request'],
  summary: 'Delete a membership request',
  description: 'Delete a membership request from a member id and an item id.',
  params: customType.StrictObject({
    itemId: customType.UUID(),
    memberId: customType.UUID(),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null(),
  },
} as const satisfies FastifySchema;
