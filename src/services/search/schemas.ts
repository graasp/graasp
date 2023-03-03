import { Ranges } from './types';

const search = {
  params: {
    keyword: {
      type: 'string',
    },
    range: {
      type: 'string',
      enum: Object.values(Ranges),
    },
  },
  required: ['range', 'keyword'],
  additionalProperties: false,
};

export { search };
