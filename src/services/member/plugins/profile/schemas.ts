import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';

const inputProfileMemberSchemaRef = registerSchemaAsRef(
  'memberShared',
  'Member Shared',
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
  body: inputProfileMemberSchemaRef,
  response: {
    [StatusCodes.CREATED]: profileMemberSchemaRef,
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getProfileForMember = {
  params: Type.Object({ memberId: customType.UUID() }, { additionalProperties: false }),
  response: {
    [StatusCodes.OK]: profileMemberSchemaRef,
    [StatusCodes.NO_CONTENT]: Type.Null(),
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getOwnProfile = {
  response: {
    [StatusCodes.OK]: profileMemberSchemaRef,
    [StatusCodes.NO_CONTENT]: Type.Null(),
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateMemberProfile = {
  body: Type.Partial(inputProfileMemberSchemaRef),
  response: {
    [StatusCodes.OK]: profileMemberSchemaRef,
    [StatusCodes.UNAUTHORIZED]: errorSchemaRef,
  },
} as const satisfies FastifySchema;
