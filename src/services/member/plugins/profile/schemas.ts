import S from 'fluent-json-schema';

import { error, uuid } from '../../../../schemas/fluent-schema';
import { partialMember } from '../../../item/fluent-schema';

const sharedProporities = {
  bio: { type: 'string' },
  facebookLink: { type: 'string' },
  linkedinLink: { type: 'string' },
  twitterLink: { type: 'string' },
};
const memberSharedSchema = S.object()
  .prop('bio', S.string())
  .prop('facebookLink', S.anyOf([S.string(), S.null()]))
  .prop('linkedinLink', S.anyOf([S.string(), S.null()]))
  .prop('twitterLink', S.anyOf([S.string(), S.null()]));

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
      memberId: { $ref: 'http://graasp.org/#/definitions/uuid' },
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
        member: { $ref: 'http://graasp.org/members/#/definitions/member' },
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
        member: { $ref: 'http://graasp.org/members/#/definitions/member' },
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
