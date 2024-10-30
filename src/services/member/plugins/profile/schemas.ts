import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

const inputPublicProfileMemberSchemaRef = customType.StrictObject({
  bio: Type.String(),
  facebookID: Type.String(),
  linkedinID: Type.String(),
  twitterID: Type.String(),
  visibility: Type.Boolean(),
});

export const profileMemberSchemaRef = registerSchemaAsRef(
  'memberProfile',
  'Member Profile',
  Type.Intersect(
    [
      inputPublicProfileMemberSchemaRef,
      customType.StrictObject({
        id: customType.UUID(),
        createdAt: customType.DateTime(),
        updatedAt: customType.DateTime(),
      }),
    ],
    { description: 'Profile of a member', additionalProperties: false },
  ),
);

export const createOwnProfile = {
  operationId: 'createOwnMemberProfile',
  tags: ['profile', 'member'],
  summary: 'Create profile for current member',
  description: 'Create profile for current member.',

  body: inputPublicProfileMemberSchemaRef,
  response: {
    [StatusCodes.CREATED]: profileMemberSchemaRef,
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getProfileForMember = {
  operationId: 'getMemberProfile',
  tags: ['profile', 'member'],
  summary: 'Get profile of given member',
  description: 'Get profile of given member',

  params: customType.StrictObject({ memberId: customType.UUID() }),
  response: {
    [StatusCodes.OK]: profileMemberSchemaRef,
    // Status NO CONTENT is used instead of NOT FOUND, so it doesn't trigger an error in the Frontend
    [StatusCodes.NO_CONTENT]: Type.Null(),
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getOwnProfile = {
  operationId: 'getOwnMemberProfile',
  tags: ['profile', 'member'],
  summary: 'Get profile of current member',
  description: 'Get profile of current member',

  response: {
    [StatusCodes.OK]: profileMemberSchemaRef,
    // Status NO CONTENT is used instead of NOT FOUND, so it doesn't trigger an error in the Frontend
    [StatusCodes.NO_CONTENT]: Type.Null(),
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateOwnMemberProfile = {
  operationId: 'updateMemberProfile',
  tags: ['profile', 'member'],
  summary: 'Update profile of current member',
  description: 'Update profile of current member',

  body: Type.Partial(inputPublicProfileMemberSchemaRef),
  response: {
    [StatusCodes.OK]: profileMemberSchemaRef,
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
