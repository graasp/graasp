import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { MembershipRequestStatus } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { itemIdSchemaRef, itemSchemaRef } from '../../../item/schemas';
import { memberSchemaRef } from '../../../member/schemas';

const completeMembershipRequestSchema = customType.StrictObject({
  member: memberSchemaRef,
  item: itemSchemaRef,
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
  tags: ['membershipRequest'],
  summary: 'Get all membership requests for an item',
  description: 'Get all membership requests with member information for an item by its ID',
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: Type.Array(simpleMembershipRequestSchemaRef, { uniqueItems: true }),
  },
} as const satisfies FastifySchema;

export const createOne = {
  tags: ['membershipRequest'],
  summary: 'Create a membership request',
  description: `Create a membership request for an item with the authenticated member. 
  The member should not have any permission on the item.
  If there is an Item Login associated with the item, the request will be rejected.`,
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: completeMembershipRequestSchemaRef,
  },
} as const satisfies FastifySchema;

export const getOwn = {
  tags: ['membershipRequest'],
  summary: 'Get the status of the membership request for the authenticated member',
  description:
    'Get the status of the membership request for the authenticated member for an item by its ID',
  params: itemIdSchemaRef,
  response: {
    [StatusCodes.OK]: customType.StrictObject({ status: Type.Enum(MembershipRequestStatus) }),
  },
} as const satisfies FastifySchema;

export const deleteOne = {
  tags: ['membershipRequest'],
  summary: 'Delete a membership request',
  description: 'Delete a membership request from a member id and an item id.',
  params: customType.StrictObject({
    itemId: customType.UUID(),
    memberId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: completeMembershipRequestSchemaRef,
  },
} as const satisfies FastifySchema;
