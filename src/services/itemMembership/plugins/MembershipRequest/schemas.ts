export default {
  $id: 'https://graasp.org/membership-request/',
  definitions: {
    membershipRequest: {
      type: 'object',
      properties: {
        id: { $ref: 'https://graasp.org/#/definitions/uuid' },
        member: { $ref: 'https://graasp.org/members/#/definitions/member' },
        item: { $ref: 'https://graasp.org/items/#/definitions/item' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
      additionalProperties: false,
    },
  },
};
