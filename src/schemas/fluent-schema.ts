import Ss from 'fluent-json-schema';

const S = Ss.default;
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

// "installed" globally to be available everywhere
// this way 'graasp-file-item', or "others", can use these using '$ref' - without using
// fluent schema or TS, just static JSON Schema
const shared = S.object()
  .id('https://graasp.org/')
  .definition('uuid', uuid)
  .definition('itemPath', itemPath)
  .definition('idParam', idParam)
  .definition('idsQuery', idsQuery)
  .definition('error', error);

export default shared;
