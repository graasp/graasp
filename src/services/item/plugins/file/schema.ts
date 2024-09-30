import { S } from 'fluent-json-schema';

import { FileItemType } from '@graasp/sdk';

import { customType } from '../../../../plugins/typebox';
import { entityIdSchemaRef } from '../../../../schemas/global';

export const upload = {
  querystring: {
    type: 'object',
    properties: {
      id: customType.UUID(),
      previousItemId: customType.UUID(),
    },
    additionalProperties: false,
  },
};

export const download = {
  params: entityIdSchemaRef,
  querystring: {
    type: 'object',
    properties: {
      replyUrl: {
        type: 'boolean',
        default: false,
      },
    },
    additionalProperties: false,
  },
};

export const updateSchema = (type: FileItemType) =>
  S.object()
    // TODO: .additionalProperties(false) in schemas don't seem to work properly and
    // are very counter-intuitive. We should change to JTD format (as soon as it is supported)
    // .additionalProperties(false)
    .prop(
      type,
      S.object().additionalProperties(false).prop('altText', S.string()).required(['altText']),
    )
    .required([type]);
