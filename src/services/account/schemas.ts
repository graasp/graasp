import { Type } from '@fastify/type-provider-typebox';

import { AccountType } from '@graasp/sdk';

import { registerSchemaAsRef } from '../../plugins/typebox';

export const accountSchemaRef = registerSchemaAsRef(
  Type.Object(
    {
      // Object Definition
      id: Type.String({ format: 'uuid' }),
      name: Type.String(),
    },
    {
      // Schema Options
      title: 'Minimal Account',
      $id: 'minimalAccount',
      additionalProperties: false,
    },
  ),
);

export const augmentedAccountSchemaRef = registerSchemaAsRef(
  Type.Intersect(
    // Object Definition
    [
      accountSchemaRef, // Base properties from minimal account

      Type.Union([
        // Then the augmented account can either be an individual or a guest
        Type.Object({
          type: Type.Literal(AccountType.Individual),
          email: Type.Optional(Type.String({ format: 'email' })),
        }),
        Type.Object({
          type: Type.Literal(AccountType.Guest),
        }),
      ]),
    ],
    {
      // Schema Options
      title: 'Augmented Account',
      $id: 'augmentedAccount',
      additionalProperties: false,
    },
  ),
);
