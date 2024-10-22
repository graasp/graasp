import { Type } from '@sinclair/typebox';
import { StatusCodes } from 'http-status-codes';

import { FastifySchema } from 'fastify';

import { PermissionLevel } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../../../plugins/typebox';
import { entityIdSchemaRef, errorSchemaRef } from '../../../../schemas/global';
import { itemMembershipSchemaRef } from '../../../itemMembership/schemas';
import { itemSchemaRef } from '../../schema';

export const invitationSchemaRef = registerSchemaAsRef(
  'invitation',
  'Invitation',
  Type.Object(
    {
      // Object Definition
      id: customType.UUID(),
      email: Type.String({ format: 'email' }),
      name: Type.Optional(customType.Nullable(Type.String())),
      permission: Type.Enum(PermissionLevel),
      item: itemSchemaRef,
      createdAt: customType.DateTime(),
      updatedAt: customType.DateTime(),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const minimalInvitationSchemaRef = registerSchemaAsRef(
  'minimalInvitation',
  'Minimal Invitation',
  Type.Object(
    {
      // Object Definition
      email: Type.String({ format: 'email' }),
      name: Type.Optional(customType.Nullable(Type.String())),
      permission: Type.Enum(PermissionLevel),
    },
    {
      // Schema Options
      additionalProperties: false,
    },
  ),
);

export const updateInvitationSchemaRef = registerSchemaAsRef(
  'updateInvitation',
  'Update Invitation',
  // Object Definition
  Type.Object(
    {
      name: Type.Optional(Type.String()),
      permission: Type.Optional(Type.Enum(PermissionLevel)),
    },
    { additionalProperties: true, minProperties: 1 },
  ),
);

export const invite = {
  params: entityIdSchemaRef,
  body: Type.Object(
    {
      invitations: Type.Array(
        Type.Object({
          email: Type.String({ format: 'email' }),
          permission: Type.Enum(PermissionLevel),
        }),
      ),
    },
    { additionalProperties: false },
  ),
  response: {
    [StatusCodes.OK]: {
      type: 'object',
      properties: {
        memberships: Type.Array(itemMembershipSchemaRef),
        invitations: Type.Array(invitationSchemaRef),
      },
    },
    '4xx': errorSchemaRef,
    [StatusCodes.INTERNAL_SERVER_ERROR]: errorSchemaRef,
  },
} as const satisfies FastifySchema;

export const inviteFromCSV = {
  params: entityIdSchemaRef,
  response: {
    [StatusCodes.OK]: Type.Object({
      memberships: Type.Array(itemMembershipSchemaRef),
      invitations: Type.Array(invitationSchemaRef),
    }),
  },
} as const satisfies FastifySchema;

export const inviteFromCSVWithTemplate = {
  params: entityIdSchemaRef,
  querystring: Type.Object({
    templateId: customType.UUID(),
  }),
  response: {
    [StatusCodes.OK]: Type.Array(
      Type.Object({
        groupName: Type.String(),
        memberships: Type.Array(itemMembershipSchemaRef),
        invitations: Type.Array(invitationSchemaRef),
      }),
    ),
  },
} as const satisfies FastifySchema;

export const getForItem = {
  params: entityIdSchemaRef,
  response: {
    [StatusCodes.OK]: Type.Array(invitationSchemaRef),
  },
} as const satisfies FastifySchema;

export const getById = {
  params: entityIdSchemaRef,
  response: {
    [StatusCodes.OK]: invitationSchemaRef,
  },
} as const satisfies FastifySchema;

export const updateOne = {
  params: Type.Object({ id: customType.UUID(), invitationId: customType.UUID() }),
  body: updateInvitationSchemaRef,
  response: {
    [StatusCodes.OK]: invitationSchemaRef,
  },
} as const satisfies FastifySchema;

export const deleteOne = {
  params: Type.Object({ id: customType.UUID(), invitationId: customType.UUID() }),
  response: {
    [StatusCodes.OK]: Type.String(),
  },
} as const satisfies FastifySchema;

export const sendOne = {
  params: Type.Object({ id: customType.UUID(), invitationId: customType.UUID() }),
} as const satisfies FastifySchema;
