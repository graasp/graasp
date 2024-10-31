import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

const inputPublicProfileMemberSchema = customType.StrictObject({
  bio: Type.String(),
  facebookID: Type.String(),
  linkedinID: Type.String(),
  twitterID: Type.String(),
  visibility: Type.Boolean(),
});

export const profileMemberSchemaRef = registerSchemaAsRef(
  'profile',
  'Profile',
  Type.Intersect(
    [
      inputPublicProfileMemberSchema,
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
  operationId: 'createOwnProfile',
  tags: ['profile', 'member'],
  summary: 'Create profile for current member',
  description: 'Create profile for current member.',

  body: inputPublicProfileMemberSchema,
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
  operationId: 'getOwnProfile',
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

export const updateOwnProfile = {
  operationId: 'updateOwnProfile',
  tags: ['profile', 'member'],
  summary: 'Update profile of current member',
  description: 'Update profile of current member',

  body: Type.Partial(inputPublicProfileMemberSchema),
  response: {
    [StatusCodes.OK]: profileMemberSchemaRef,
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
