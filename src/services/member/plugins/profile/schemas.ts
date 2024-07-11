import { S } from 'fluent-json-schema';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { error, uuid } from '../../../../schemas/fluent-schema';
import { partialMember } from '../../../item/fluent-schema';

const memberSharedSchema = S.object()
  .additionalProperties(false)
  .prop('bio', S.string())
  .prop('facebookID', S.anyOf([S.string(), S.null()]))
  .prop('linkedinID', S.anyOf([S.string(), S.null()]))
  .prop('twitterID', S.anyOf([S.string(), S.null()]));

export const profileMember = S.object()
  .prop('id', uuid)
  .prop('bio', S.string())
  .prop('visibility', S.boolean())
  .prop('facebookID', S.string())
  .prop('linkedinID', S.string())
  .prop('twitterID', S.string())
  .prop('createdAt', S.string().format('date-time'))
  .prop('updatedAt', S.string().format('date-time'))
  .prop('member', partialMember);

export const createProfile = {
  body: S.object()
    .additionalProperties(false)
    .prop('visibility', S.boolean())
    // QUESTION: why is the bio always required ? Can't we only update a social link ?
    .required(['bio'])
    .extend(memberSharedSchema),
  response: {
    [StatusCodes.CREATED]: profileMember,
    [StatusCodes.UNAUTHORIZED]: error,
  },
};

export const getProfileForMember: FastifySchema = {
  params: S.object().additionalProperties(false).prop('memberId', uuid),
  response: {
    [StatusCodes.OK]: profileMember,
    [StatusCodes.NO_CONTENT]: S.null(),
    [StatusCodes.UNAUTHORIZED]: error,
  },
};

export const getOwnProfile: FastifySchema = {
  response: {
    [StatusCodes.OK]: profileMember,
    [StatusCodes.NO_CONTENT]: S.null(),
    [StatusCodes.UNAUTHORIZED]: error,
  },
};

export const updateMemberProfile = {
  body: S.object()
    .additionalProperties(false)
    .prop('visibility', S.boolean())
    .extend(memberSharedSchema),
  response: {
    [StatusCodes.OK]: profileMember,
    [StatusCodes.UNAUTHORIZED]: error,
  },
};
