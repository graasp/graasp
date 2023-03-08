import S from 'fluent-json-schema';

import { ItemLoginSchemaType } from '@graasp/sdk';

import { error, idParam, uuid } from '../../../schemas/fluent-schema';
import { item } from '../../item/fluent-schema';

export const credentials = S.object()
  .additionalProperties(false)
  .prop('username', S.string().minLength(3).maxLength(50).pattern('^\\S+( \\S+)*$'))
  .prop('password', S.string().minLength(3).maxLength(50).pattern('^\\S+( \\S+)*$'))
  .prop('memberId', uuid)
  .oneOf([S.required(['username']), S.required(['memberId'])]);

const loginSchemaType = S.string().enum(Object.values(ItemLoginSchemaType));

export const loginSchema = S.object()
  .additionalProperties(false)
  .prop('type', loginSchemaType)
  .prop('item', item);

export const login = {
  params: idParam,
  querystring: S.object().additionalProperties(false).prop('m', S.boolean()),
  body: credentials,
  response: {
    // TODO: use member schema
    // '2xx': memberSchemas.member,
    '4xx': error,
    '5xx': error,
  },
};

export const getLoginSchemaType = {
  params: idParam,
  response: {
    '2xx': S.oneOf([loginSchemaType, S.null()]),
    '4xx': error,
    '5xx': error,
  },
};

export const getLoginSchema = {
  params: idParam,
  response: {
    '2xx': loginSchema,
    '4xx': error,
    '5xx': error,
  },
};

export const updateLoginSchema = {
  params: idParam,
  body: loginSchema,
  response: {
    '2xx': loginSchema,
    '4xx': error,
    '5xx': error,
  },
};
