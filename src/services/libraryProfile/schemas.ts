import S from 'fluent-json-schema';

import { error, uuid } from '../../schemas/fluent-schema';

const partialMember = S.object()
  .additionalProperties(false)
  .prop('id', S.string())
  .prop('name', S.string())
  .prop('email', S.string());

export const profileMember = S.object()
  // .additionalProperties(false)
  .prop('id', uuid)
  .prop('bio', S.string())
  .prop('facebookLink', S.string())
  .prop('linkedinLink', S.string())
  .prop('twitterLink', S.string())
  .prop('visibility', S.boolean())
  .prop('member', S.ifThenElse(S.null(), S.null(), partialMember))
  .prop('createdAt', S.raw({}))
  .prop('updatedAt', S.raw({}));

export const createProfile = {
  response: {
    201: profileMember,
    '4xx': error,
  },
  body: S.object()
    .prop('bio', S.string())
    .prop('facebookLink', S.string())
    .prop('linkedinLink', S.string())
    .prop('twitterLink', S.string())
    .prop('visibility', S.boolean())
    .required(['bio']),
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
    200: S.object()
      .additionalProperties(false)
      .prop('id', uuid)
      .prop('bio', S.string())
      .prop('facebookLink', S.string())
      .prop('linkedinLink', S.string())
      .prop('twitterLink', S.string())
      .prop('member', S.ifThenElse(S.null(), S.null(), partialMember))
      .prop('createdAt', S.raw({}))
      .prop('updatedAt', S.raw({})),
    '4xx': error,
  },
};

export const updateMemberProfile = {
  response: {
    200: profileMember,
    '4xx': error,
  },
  params: {
    type: 'object',
    properties: {
      profileId: { $ref: 'http://graasp.org/#/definitions/uuid' },
    },
    additionalProperties: false,
  },
  body: S.object()
    .prop('bio', S.string())
    .prop('facebookLink', S.string())
    .prop('linkedinLink', S.string())
    .prop('twitterLink', S.string())
    .prop('visibility', S.boolean()),
};
