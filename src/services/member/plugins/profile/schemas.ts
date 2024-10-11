import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

const inputPublicProfileMemberSchemaRef = registerSchemaAsRef(
  'publicProfile',
  'Public Profile',

  Type.Object(
    {
      bio: Type.String(),
      facebookID: Type.String(),
      linkedinID: Type.String(),
      twitterID: Type.String(),
      visibility: Type.Boolean(),
    },
    { additionalProperties: false },
  ),
);

export const profileMemberSchemaRef = registerSchemaAsRef(
  'profileMember',
  'Profile Member',
  Type.Object({
    id: customType.UUID(),
    bio: Type.String(),
    facebookID: Type.String(),
    linkedinID: Type.String(),
    twitterID: Type.String(),
    visibility: Type.Boolean(),
    createdAt: customType.DateTime(),
    updatedAt: customType.DateTime(),
  }),
);

export const createProfile = {
  body: inputPublicProfileMemberSchemaRef,
  response: {
    [StatusCodes.CREATED]: profileMemberSchemaRef,
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getProfileForMember = {
  params: Type.Object({ memberId: customType.UUID() }, { additionalProperties: false }),
  response: {
    [StatusCodes.OK]: profileMemberSchemaRef,
    // Status NO CONTENT is used instead of NOT FOUND, so it doesn't trigger an error in the Frontend
    [StatusCodes.NO_CONTENT]: Type.Null(),
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getOwnProfile = {
  response: {
    [StatusCodes.OK]: profileMemberSchemaRef,
    // Status NO CONTENT is used instead of NOT FOUND, so it doesn't trigger an error in the Frontend
    [StatusCodes.NO_CONTENT]: Type.Null(),
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateMemberProfile = {
  body: Type.Partial(inputPublicProfileMemberSchemaRef),
  response: {
    [StatusCodes.OK]: profileMemberSchemaRef,
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
  },
} as const satisfies FastifySchema;
