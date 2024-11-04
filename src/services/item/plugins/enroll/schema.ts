import { StatusCodes } from 'http-status-codes';

import { customType } from '../../../../plugins/typebox';
import { itemMembershipSchemaRef } from '../../../itemMembership/schemas';

export const enroll = {
  operationId: 'enroll',
  tags: ['itemMemberships'],
  summary: 'Create an item membership for the logged in user if there is an Item Login',
  description: `Create an item membership on the item with the given ID for the logged in user. 
    The item needs to be associated with an Item Login.`,
  params: customType.StrictObject({
    itemId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: itemMembershipSchemaRef,
  },
};
