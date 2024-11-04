import { faker } from '@faker-js/faker';
import { v4 } from 'uuid';

import { TagCategory } from '@graasp/sdk';

export function TagFactory(args: { name?: string; category?: TagCategory } = {}) {
  return {
    id: v4(),
    name: args.name ?? faker.word.noun(),
    category: args.category ?? faker.helpers.enumValue(TagCategory),
  };
}
