import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

// schema for removing all actions of a member
export const deleteAll: FastifySchema = {
  response: {
    [StatusCodes.NO_CONTENT]: { type: 'null' },
  },
};

export const getMemberFilteredActions = {
  querystring: {
    type: 'object',
    properties: {
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
    },
    additionalProperties: false,
  },
};
