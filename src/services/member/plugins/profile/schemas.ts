import S from 'fluent-json-schema';

import { error, uuid } from '../../../../schemas/fluent-schema.js';
import { partialMember } from '../../../item/fluent-schema.js';

const sharedProporities = {
  bio: { type: 'string' },
  facebookID: { type: 'string' },
  linkedinID: { type: 'string' },
  twitterID: { type: 'string' },
};
const memberSharedSchema = S.object()
  .prop('bio', S.string())
  .prop('facebookID', S.anyOf([S.string(), S.null()]))
  .prop('linkedinID', S.anyOf([S.string(), S.null()]))
  .prop('twitterID', S.anyOf([S.string(), S.null()]));

export const profileMember = S.object()
  .additionalProperties(false)
  .prop('id', uuid)
  .prop('visibility', S.boolean())
  .prop('member', partialMember)
  .prop('createdAt', S.raw({}))
  .prop('updatedAt', S.raw({}))
  .extend(memberSharedSchema);

export const createProfile = {
  response: {
    201: profileMember,
    '4xx': error,
  },
  body: S.object()
    .prop('visibility', S.boolean())
    .additionalProperties(false)
    .required(['bio'])
    .extend(memberSharedSchema),
};

export const getProfileForMember = {
  params: {
    type: 'object',
    properties: {
      memberId: { $ref: 'https://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string' },
        ...sharedProporities,
        member: { $ref: 'https://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
    '4xx': error,
  },
};

export const getOwnProfile = {
  response: {
    200: {
      type: 'object',
      nullable: true,
      properties: {
        id: { type: 'string' },
        ...sharedProporities,
        member: { $ref: 'https://graasp.org/members/#/definitions/member' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
        visibility: { type: 'boolean' },
      },
    },
    '4xx': error,
  },
};

export const updateMemberProfile = {
  response: {
    200: profileMember,
    '4xx': error,
  },
  body: S.object()
    .additionalProperties(false)
    .prop('visibility', S.boolean())
    .extend(memberSharedSchema),
};
