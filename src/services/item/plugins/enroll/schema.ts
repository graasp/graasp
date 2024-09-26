import { StatusCodes } from 'http-status-codes';

import { customType } from '../../../../plugins/typebox';

export const enroll = {
  tags: ['itemMemberships'],
  summary: 'Create an item membership for the logged in user if there is an Item Login',
  description: `Create an item membership on the item with the given ID for the logged in user. 
    The item needs to be associated with an Item Login.`,
  params: {
    type: 'object',
    required: ['itemId'],
    properties: {
      itemId: customType.UUID(),
    },
  },
  response: {
    [StatusCodes.OK]: {
      $ref: 'https://graasp.org/item-memberships/#/definitions/itemMembership',
    },
  },
};
