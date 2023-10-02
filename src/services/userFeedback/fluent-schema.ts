import S from 'fluent-json-schema';

import { error } from '../../schemas/fluent-schema';

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export const userFeedbackSchema = {
  body: S.object()
    .prop('name', S.string().minLength(1))
    .prop('email', S.string().pattern(emailPattern))
    .prop('details', S.string().minLength(1))
    .required(['name', 'email', 'details']),
  response: {
    200: S.object().additionalProperties(false).prop('message', S.string()),
    '4xx': error,
  },
};
