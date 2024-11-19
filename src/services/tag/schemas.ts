import { Type } from '@sinclair/typebox';

import { TagCategory } from '@graasp/sdk';

import { customType, registerSchemaAsRef } from '../../plugins/typebox';

const tagSchema = customType.StrictObject(
  {
    id: customType.UUID(),
    name: Type.String(),
    category: Type.Enum(TagCategory),
  },
  { description: 'User provided tag, representing a theme or subject' },
);

export const tagSchemaRef = registerSchemaAsRef('tag', 'Tag', tagSchema);
