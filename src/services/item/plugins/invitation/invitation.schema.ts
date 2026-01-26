import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import type { FastifySchema } from 'fastify';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { errorSchemaRef } from '../../../../schemas/global';
import { permissionLevelSchemaRef } from '../../../../types';
import { itemMembershipWithoutRelationsSchemaRef } from '../../../itemMembership/membership.schemas';
import { itemSchemaRef } from '../../item.schemas';

export const invitationSchemaRef = registerSchemaAsRef(
  'invitation',
  'Invitation',
  customType.StrictObject(
    {
      id: customType.UUID(),
      email: Type.String({ format: 'email' }),
      name: Type.Optional(customType.Nullable(Type.String())),
      permission: permissionLevelSchemaRef,
      item: itemSchemaRef,
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
    },
    {
      description:
        'Invitation for a non-registered user to access an item. The user is identified by email.',
    },
  ),
);
export const invitationWithoutRelationSchemaRef = registerSchemaAsRef(
  'invitationWithoutRelations',
  'Invitation Without Relations',
  customType.StrictObject(
    {
      id: customType.UUID(),
      email: Type.String({ format: 'email' }),
      name: Type.Optional(customType.Nullable(Type.String())),
      permission: permissionLevelSchemaRef,
      itemPath: Type.String(),
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
    },
    {
      description:
        'Invitation for a non-registered user to access an item. The user is identified by email.',
    },
  ),
);

export const invite = {
  operationId: 'createInvitation',
  tags: ['invitation'],
  summary: 'Invite user by email to access an item',
  description: 'Invite non-registered user with their email to access given item.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  body: customType.StrictObject({
    invitations: Type.Array(
      Type.Object({
        email: Type.String({ format: 'email' }),
        permission: permissionLevelSchemaRef,
      }),
    ),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
    [StatusCodes.INTERNAL_SERVER_ERROR]: errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const inviteFromCSV = {
  operationId: 'inviteFromCSV',
  tags: ['invitation'],
  summary: 'Invite users from CSV file',
  description: 'Invite users from CSV file, given their email, optional name and permission level.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const inviteFromCSVWithTemplate = {
  operationId: 'inviteFromCSVWithTemplate',
  tags: ['invitation'],
  summary: 'Invite users from CSV file in groups given a template',
  description:
    'Invite users by groups from CSV. This will create groups of users having access to corresponding resources from a given template.',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  querystring: Type.Object({
    templateId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(
      Type.Object({
        groupName: Type.String(),
        memberships: Type.Array(itemMembershipWithoutRelationsSchemaRef),
        invitations: Type.Array(invitationWithoutRelationSchemaRef),
      }),
      { description: 'Successful Response' },
    ),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getForItem = {
  operationId: 'getInvitationForItem',
  tags: ['invitation'],
  summary: 'Get invitations for a given item',
  description: 'Get invitation for a given item',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(invitationSchemaRef, { description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const getById = {
  operationId: 'getInvitationById',
  tags: ['invitation'],
  summary: 'Get invitation',
  description: 'Get invitation by id',

  params: customType.StrictObject({
    id: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: invitationSchemaRef,
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateOne = {
  operationId: 'updateInvitation',
  tags: ['invitation'],
  summary: 'Update invitation',
  description: "Update invitation's name or permission",

  params: Type.Object({ id: customType.UUID(), invitationId: customType.UUID() }),
  body: customType.StrictObject(
    {
      name: Type.Optional(Type.String()),
      permission: Type.Optional(permissionLevelSchemaRef),
    },
    { minProperties: 1 },
  ),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteOne = {
  operationId: 'deleteInvitation',
  tags: ['invitation'],
  summary: 'Delete invitation',
  description: 'Delete invitation',

  params: Type.Object({ id: customType.UUID(), invitationId: customType.UUID() }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const sendOne = {
  operationId: 'sendInvitation',
  tags: ['invitation'],
  summary: 'Send invitation',
  description: 'Send invitation',

  params: Type.Object({ id: customType.UUID(), invitationId: customType.UUID() }),
  response: {
    [StatusCodes.NO_CONTENT]: Type.Null({ description: 'Successful Response' }),
    '4xx': errorSchemaRef,
  },
} as const satisfies FastifySchema;
