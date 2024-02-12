import S from 'fluent-json-schema';

import { FileItemType } from '@graasp/sdk';

export const upload = {
  querystring: {
    type: 'object',
    properties: {
      id: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
};

export const download = {
  params: { $ref: 'https://graasp.org/#/definitions/idParam' },
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
