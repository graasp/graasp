import S from 'fluent-json-schema';
import {error, idsQuery} from '../../schemas/fluent-schema';

export default {
  $id: 'http://graasp.org/groups/',
  definitions: {
    group: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' }
      },
      additionalProperties: false
    },

    // member properties that can be modified with user input
    partialGroup: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, pattern: '^\\S+( \\S+)*$' },
        extra: { type: 'object', additionalProperties: true }
      },
      additionalProperties: false
    },

    // partialMember requiring one property to be defined
    partialGroupRequireOne: {
      allOf: [
        { $ref: '#/definitions/partialGroup' },
        {
          anyOf: [
            { required: ['name'] },
            { required: ['extra'] }
          ]
        }
      ]
    }
  }
};

const create = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: {type: 'string', pattern: '^\\S+( \\S+)*$'},
      email: {type: 'string', format: 'email'}
    },
    additionalProperties: false,
  },
  response: {
    200: { $ref: 'http://graasp.org/members/#/definitions/member' },
    '4xx': error
  },
};

const getMany = {
  querystring: S.object()
    .prop('id', S.array())
    .extend(idsQuery),
  response: {
    '4xx': error
  }
};

export {
  create,
  getMany
};
