import { StatusCodes } from 'http-status-codes';

import { customType } from '../../../../plugins/typebox';
import { entityIdSchemaRef, errorSchemaRef } from '../../../../schemas/global';

export default {
  $id: 'https://graasp.org/invitations/',
  definitions: {
    invitation: {
      type: 'object',
      properties: {
        id: customType.UUID(),
        email: { type: 'string', format: 'email' },
        name: { type: ['string', 'null'] },
        permission: { type: 'string' },
        item: { $ref: 'https://graasp.org/items/#/definitions/item' },

        /**
         * for some reason setting these date fields as "type: 'string'"
         * makes the serialization fail using the anyOf. Following the same
         * logic from above, here it's also safe to just remove that specification.
         */
        createdAt: { format: 'date-time' },
        updatedAt: { format: 'date-time' },
      },
      additionalProperties: false,
    },

    // partial invitation requiring some properties to be defined
    // item id is defined from the param of the endpoint
    partialInvitation: {
      type: 'object',
      required: ['email', 'permission'],
      properties: {
        email: { type: 'string', format: 'email' },
        permission: { type: 'string' },
        name: { type: 'string' },
      },
      additionalProperties: false,
    },

    // partial invitation for update
    // item id is defined from the param of the endpoint
    partialInvitationForUpdate: {
      type: 'object',
      properties: {
        permission: { type: 'string' },
        name: { type: 'string' },
      },
      anyOf: [
        {
          required: ['permission'],
        },
        {
          required: ['name'],
        },
      ],
      additionalProperties: false,
    },
  },
};

export const invite = {
  params: entityIdSchemaRef,
  body: {
    type: 'object',
    properties: {
      invitations: {
        type: 'array',
        items: {
          type: 'object',
          required: ['email', 'permission'],
          properties: {
            email: { type: 'string', format: 'email' },
            permission: { type: 'string' },
          },
        },
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        memberships: {
          type: 'array',
          items: {
            $ref: 'https://graasp.org/item-memberships/#/definitions/itemMembership',
          },
        },
        invitations: {
          type: 'array',
          items: {
            $ref: 'https://graasp.org/invitations/#/definitions/invitation',
          },
        },
      },
    },
    '4xx': errorSchemaRef,
    [StatusCodes.INTERNAL_SERVER_ERROR]: errorSchemaRef,
  },
};

export const getForItem = {
  params: entityIdSchemaRef,
  response: {
    200: {
      type: 'array',
      items: { $ref: 'https://graasp.org/invitations/#/definitions/invitation' },
    },
  },
};

export const getById = {
  params: entityIdSchemaRef,
  response: {
    200: { $ref: 'https://graasp.org/invitations/#/definitions/invitation' },
  },
};

export const updateOne = {
  params: {
    type: 'object',
    required: ['id', 'invitationId'],
    properties: {
      id: customType.UUID(),
      invitationId: customType.UUID(),
    },
  },
  body: { $ref: 'https://graasp.org/invitations/#/definitions/partialInvitationForUpdate' },
  response: {
    200: { $ref: 'https://graasp.org/invitations/#/definitions/invitation' },
  },
};

export const deleteOne = {
  params: {
    type: 'object',
    required: ['id', 'invitationId'],
    properties: {
      id: customType.UUID(),
      invitationId: customType.UUID(),
    },
  },
  response: {
    200: { type: 'string' },
  },
};

export const sendOne = {
  params: {
    type: 'object',
    required: ['id', 'invitationId'],
    properties: {
      id: customType.UUID(),
      invitationId: customType.UUID(),
    },
  },
};
