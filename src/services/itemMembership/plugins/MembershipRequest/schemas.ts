import { FastifySchema } from 'fastify';

import { MembershipRequestStatus } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';

export const completeMembershipRequest = {
  $id: 'completeMembershipRequest',
  type: 'object',
  properties: {
    member: { $ref: 'https://graasp.org/members/#/definitions/member' },
    item: { $ref: 'https://graasp.org/items/#/definitions/item' },
    createdAt: { type: 'string' },
  },
  additionalProperties: false,
};

export const simpleMembershipRequest = {
  $id: 'simpleMembershipRequest',
  type: 'object',
  properties: {
    member: { $ref: 'https://graasp.org/members/#/definitions/member' },
    createdAt: { type: 'string' },
  },
  additionalProperties: false,
};

export const getAllByItem: FastifySchema = {
  tags: ['membershipRequest'],
  summary: 'Get all membership requests for an item',
  description: 'Get all membership requests with member information for an item by its ID',
  params: {
    type: 'object',
    properties: {
      itemId: customType.UUID(),
    },
    required: ['itemId'],
  },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'simpleMembershipRequest' },
      uniqueItems: true,
    },
  },
};

export const createOne: FastifySchema = {
  tags: ['membershipRequest'],
  summary: 'Create a membership request',
  description: `Create a membership request for an item with the authenticated member. 
  The member should not have any permission on the item.
  If there is an Item Login associated with the item, the request will be rejected.`,
  params: {
    type: 'object',
    properties: {
      itemId: customType.UUID(),
    },
    required: ['itemId'],
  },
  response: {
    200: { $ref: 'completeMembershipRequest' },
  },
};

export const getOwn: FastifySchema = {
  tags: ['membershipRequest'],
  summary: 'Get the status of the membership request for the authenticated member',
  description:
    'Get the status of the membership request for the authenticated member for an item by its ID',
  params: {
    type: 'object',
    properties: {
      itemId: customType.UUID(),
    },
    required: ['itemId'],
  },
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: Object.values(MembershipRequestStatus) },
      },
    },
  },
};

export const deleteOne: FastifySchema = {
  tags: ['membershipRequest'],
  summary: 'Delete a membership request',
  description: 'Delete a membership request from a member id and an item id.',
  params: {
    type: 'object',
    properties: {
      itemId: customType.UUID(),
      memberId: customType.UUID(),
    },
    required: ['itemId', 'memberId'],
  },
  response: {
    200: { $ref: 'completeMembershipRequest' },
  },
};
