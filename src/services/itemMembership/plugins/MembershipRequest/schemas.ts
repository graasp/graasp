import { FastifySchema } from 'fastify';

export default {
  $id: 'membershipRequest',
  type: 'object',
  properties: {
    id: { $ref: 'https://graasp.org/#/definitions/uuid' },
    member: { $ref: 'https://graasp.org/members/#/definitions/member' },
    item: { $ref: 'https://graasp.org/items/#/definitions/item' },
    createdAt: { type: 'string' },
    updatedAt: { type: 'string' },
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
      itemId: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
    required: ['itemId'],
  },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'membershipRequest' },
      uniqueItems: true,
    },
  },
};

export const createOne: FastifySchema = {
  tags: ['membershipRequest'],
  summary: 'Create a membership request',
  description: 'Create a membership request for an item with the authenticated member',
  params: {
    type: 'object',
    properties: {
      itemId: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
    required: ['itemId'],
  },
  response: {
    200: { $ref: 'membershipRequest' },
  },
};
