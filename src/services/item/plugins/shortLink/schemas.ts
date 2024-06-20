import { UUID } from 'typeorm/driver/mongodb/bson.typings';

import { ShortLinkPlatform } from '@graasp/sdk';

const shortLinkPayload = {
  type: 'object',
  properties: {
    alias: { type: 'string', minLength: 6, maxLength: 255, pattern: '^[a-zA-Z0-9-]*$' },
    platform: { type: 'string', enum: Object.values(ShortLinkPlatform) },
    itemId: {
      type: 'string',
      pattern: UUID,
    },
  },
  additionalProperties: false,
};

const create = {
  body: {
    ...shortLinkPayload,
    required: ['alias', 'platform', 'itemId'],
  },
};

const update = {
  body: {
    ...shortLinkPayload,
    not: {
      required: ['itemId'], // Exclude 'itemId' from the properties of the update schema
    },
    anyOf: [{ required: ['alias'] }, { required: ['platform'] }], // at least one valid property
  },
};

const restricted_get = {
  response: {
    200: {
      type: 'object',
      properties: {
        itemId: { type: 'string' },
        alias: { type: 'string' },
        platform: { type: 'string' },
        createdAt: { type: 'string' },
      },
    },
  },
};

export { restricted_get, create, update };
