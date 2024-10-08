import { S } from 'fluent-json-schema';

export const uuid = S.string().pattern(
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$',
);

export const itemPath = S.string().pattern(
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}' +
    '(.[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})*$',
);

export const idParam = S.object().prop('id', uuid).required(['id']);

export const idsQuery = S.object()
  .additionalProperties(false)
  .prop('id', S.array().items(uuid).uniqueItems(true))
  .required(['id']);

export const error = S.object()
  .additionalProperties(false)
  .prop('name', S.string())
  .prop('code', S.string())
  .prop('message', S.string())
  .prop('statusCode', S.number())
  .prop('data', S.raw({}))
  .prop('origin', S.string())
  .prop('error', S.string())
  // .prop('stack', S.object())
  .prop('validation', S.array().items(S.object().additionalProperties(true)));
