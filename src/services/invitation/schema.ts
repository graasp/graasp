const UUID_REGEX = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

export default {
  $id: 'http://graasp.org/invitations/',
  definitions: {
    invitation: {
      type: 'object',
      properties: {
        id: { $ref: 'http://graasp.org/#/definitions/uuid' },
        email: { type: 'string', format: 'email' },
        name: { type: ['string', 'null'] },
        permission: { type: 'string' },
        item: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            path: { type: 'string' },
            type: { type: 'string' },
            creator: { $ref: 'http://graasp.org/members/#/definitions/member' },
            createdAt: { type: 'string' },
            updatedAt: { type: 'string' },
          },
          additionalProperties: false,
        },
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
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  body: {
    type: 'object',
    properties: {
      invitations: {
        type: 'array',
        items: { $ref: 'http://graasp.org/invitations/#/definitions/partialInvitation' },
      },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'object',
          patternProperties: {
            [UUID_REGEX]: { $ref: 'http://graasp.org/invitations/#/definitions/invitation' },
          },
        },
        errors: {
          type: 'array',
          items: {
            $ref: 'http://graasp.org/#/definitions/error',
          },
        },
      },
    },
  },
};

export const getForItem = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  response: {
    200: {
      type: 'array',
      items: { $ref: 'http://graasp.org/invitations/#/definitions/invitation' },
    },
  },
};

export const getById = {
  params: { $ref: 'http://graasp.org/#/definitions/idParam' },
  response: {
    200: { $ref: 'http://graasp.org/invitations/#/definitions/invitation' },
  },
};

export const updateOne = {
  params: {
    type: 'object',
    required: ['id', 'invitationId'],
    properties: {
      id: { $ref: 'http://graasp.org/#/definitions/uuid' },
      invitationId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
  },
  body: { $ref: 'http://graasp.org/invitations/#/definitions/partialInvitationForUpdate' },
  response: {
    200: { $ref: 'http://graasp.org/invitations/#/definitions/invitation' },
  },
};

export const deleteOne = {
  params: {
    type: 'object',
    required: ['id', 'invitationId'],
    properties: {
      id: { $ref: 'http://graasp.org/#/definitions/uuid' },
      invitationId: { $ref: 'http://graasp.org/#/definitions/uuid' },
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
      id: { $ref: 'http://graasp.org/#/definitions/uuid' },
      invitationId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
  },
};
