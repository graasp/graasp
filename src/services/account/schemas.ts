import { Type } from '@fastify/type-provider-typebox';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';
import { AccountType } from '../../types';

const accountSchema = customType.StrictObject(
  {
    id: customType.UUID(),
    name: customType.Username(),
  },
  {
    description: 'Minimal sharable account properties',
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

export const accountTypeIndividualRef = registerSchemaAsRef(
  'accountTypeIndividual',
  'Account Type Individual',
  Type.Literal(AccountType.Individual),
);
export const accountTypeGuestRef = registerSchemaAsRef(
  'accountTypeGuest',
  'Account Type Guest',
  Type.Literal(AccountType.Guest),
);

const compositeMemberAccountSchema = Type.Composite([
  accountSchema, // Base properties from minimal account
  customType.StrictObject(
    {
      type: accountTypeIndividualRef,
      email: Type.String({ format: 'email' }),
    },
    {
      description:
        'Member information that are not public. These information are only shared with people you collaborate with.',
    },
  ),
]);
const compositeGuestAccountSchema = Type.Composite([
  accountSchema, // Base properties from minimal account
  customType.StrictObject(
    {
      type: accountTypeGuestRef,
    },
    { description: 'Guest sharable information' },
  ),
]);

export const augmentedAccountSchemaRef = registerSchemaAsRef(
  'augmentedAccount',
  'Augmented Account',
  Type.Union([compositeMemberAccountSchema, compositeGuestAccountSchema], {
    discriminator: { propertyName: 'type' },
    description: 'The augmented account can either be an individual or a guest',
  }),
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
      description: 'The augmented account can either be an individual or a guest, or null',
    },
  ),
);
