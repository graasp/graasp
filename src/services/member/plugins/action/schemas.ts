import { idParam } from '../../../../schemas/fluent-schema';

// schema for removing all actions of a member
export const deleteAllById = {
  params: idParam,
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
