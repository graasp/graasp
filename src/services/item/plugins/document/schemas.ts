import Ss from 'fluent-json-schema';

import { DocumentItemExtraFlavor, ItemType } from '@graasp/sdk';

const S = Ss.default;

export const updateSchema = S.object()
  // TODO: .additionalProperties(false) in schemas don't seem to work properly and
  // are very counter-intuitive. We should change to JTD format (as soon as it is supported)
  // .additionalProperties(false)
  .prop(
    ItemType.DOCUMENT,
    S.object()
      // .additionalProperties(false)
      .prop('content', S.string())
      .prop('flavor', S.string().enum(Object.values(DocumentItemExtraFlavor)))
      .prop('isRaw', S.boolean())
      .required(['content']),
  )
  .required([ItemType.DOCUMENT]);

export const createSchema = S.object()
  .prop('type', S.const(ItemType.DOCUMENT))
  .prop('extra', updateSchema)
  .required(['type', 'extra']);
