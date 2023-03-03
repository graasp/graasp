import { v4 } from 'uuid';

import { CategoryRepository } from '../repositories/category';

export const CATEGORY_TYPES = [
  {
    id: v4(),
    name: 'category-1',
  },
  {
    id: v4(),
    name: 'category-2',
  },
];

export const PUBLIC_TAG_ID = v4();
