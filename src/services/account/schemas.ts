import { Type } from '@fastify/type-provider-typebox';

import { AccountType } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';

const accountSchema = Type.Object(
  {
    // Object Definition
    id: customType.UUID(),
    name: Type.String(),
  },
  {
    // Schema Options
    additionalProperties: false,
  },
);

export const accountSchemaRef = registerSchemaAsRef(
  'minimalAccount',
  'Minimal Account',
  accountSchema,
);
export const nullableAccountSchemaRef = registerSchemaAsRef(
  'nullableMinimalAccount',
  'Nullable Minimal Account',
  customType.Nullable(accountSchema),
);

const compositeMemberAccountSchema = Type.Composite([
  accountSchema, // Base properties from minimal account
  Type.Object(
    {
      type: Type.Literal(AccountType.Individual),
      email: Type.String({ format: 'email' }),
    },
    { additionalProperties: false },
  ),
]);
const compositeGuestAccountSchema = Type.Composite(
  // Guest Account
  [
    accountSchema, // Base properties from minimal account
    Type.Object(
      {
        type: Type.Literal(AccountType.Guest),
      },
      { additionalProperties: false },
    ),
  ],
);

export const augmentedAccountSchemaRef = registerSchemaAsRef(
  'augmentedAccount',
  'Augmented Account',
  Type.Union(
    [
      // The augmented account can either be an individual or a guest
      compositeMemberAccountSchema,
      compositeGuestAccountSchema,
    ],
    {
      // Schema Options
      discriminator: { propertyName: 'type' },
    },
  ),
);

export const nullableAugmentedAccountSchemaRef = registerSchemaAsRef(
  'nullableAugmentedAccount',
  'Nullable Augmented Account',
  Type.Union(
    [
      // The augmented account can either be an individual or a guest
      customType.Nullable(compositeMemberAccountSchema),
      customType.Nullable(compositeGuestAccountSchema),
    ],
    {
      discriminator: { propertyName: 'type' },
    },
  ),
);
