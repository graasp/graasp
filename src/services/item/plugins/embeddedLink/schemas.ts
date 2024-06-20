import { S } from 'fluent-json-schema';

import { ItemType } from '@graasp/sdk';

import { error } from '../../../../schemas/fluent-schema';

// on link creation or update, the only allowed property in extra is the "url" property.
// all other extra properties are filled by the backend.
const strictUrlProperty = S.object()
  .additionalProperties(false)
  .prop('url', S.string().format('url'))
  .required(['url']);

// schema defining the properties that can be supplied on the "extra" for the link item on creation
const embeddedLinkItemExtraCreate = S.object()
  .additionalProperties(false)
  .prop(ItemType.LINK, strictUrlProperty)
  .required([ItemType.LINK]);

// schema upgrading the general item creation schema, specifying the link properties allowed on creation
export const createSchema = S.object()
  .prop('type', S.const(ItemType.LINK))
  .prop('extra', embeddedLinkItemExtraCreate)
  .required(['type', 'extra']);

// schema defining the properties that can be supplied on the "extra" for the link item on update
export const updateExtraSchema = S.object()
  .additionalProperties(false)
  .prop(ItemType.LINK, strictUrlProperty)
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
