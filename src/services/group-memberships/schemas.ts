import S from 'fluent-json-schema';
import {uuid} from '../../schemas/fluent-schema';

export default {
  $id: 'http://graasp.org/group-memberships/',
  definitions: {
    // item membership properties to be returned to the client
    groupMembership: {
      type: 'object',
      properties: {
        id: {$ref: 'http://graasp.org/#/definitions/uuid'},
        member: {$ref: 'http://graasp.org/#/definitions/uuid'},
        group: {$ref: 'http://graasp.org/#/definitions/uuid'},
      },
      additionalProperties: false
    },
  }
};

const create = {
  querystring: {
    type: 'object',
    required: ['groupId'],
    properties: {
      groupId: { $ref: 'http://graasp.org/#/definitions/uuid' }
    },
    additionalProperties: false
  },
  body: S.object().additionalProperties(false).
        prop('member',uuid).required(['member']),
  response: {
    201: { $ref: 'http://graasp.org/group-memberships/#/definitions/groupMembership' }
  }
};

export {
  create
};
