import S from 'fluent-json-schema';

import { ItemType } from '@graasp/sdk';

import { error } from '../../../../schemas/fluent-schema';

const embeddedLinkItemExtraCreate = S.object()
  .additionalProperties(false)
  .prop(
    ItemType.LINK,
    // only allow to set url in extra on create
    S.object().additionalProperties(false).prop('url', S.string().format('url')).required(['url']),
  )
  .required([ItemType.LINK]);

export const createSchema = S.object()
  .prop('type', S.const(ItemType.LINK))
  .prop('extra', embeddedLinkItemExtraCreate)
  .required(['type', 'extra']);

// schema defining the allowed properties for the link item
export const updateExtraSchema = S.object()
  .additionalProperties(false)
  .prop(
    ItemType.LINK,
    // only allow to set url in extra on create
    S.object().additionalProperties(false).prop('url', S.string().format('url')).required(['url']),
  )
  .required([ItemType.LINK]);

export const getLinkMetadata = {
  querystring: S.object().additionalProperties(false).prop('link', S.string().format('url')),
  response: {
    '2xx': S.object()
      .additionalProperties(false)
      .prop('title', S.string())
      .prop('description', S.string())
      .prop('html', S.string())
      .prop('isEmbeddingAllowed', S.boolean())
      .prop('icons', S.array().items(S.string()))
      .prop('thumbnails', S.array().items(S.string())),
    '4xx': error,
  },
};
