import { TagCategory } from '@graasp/sdk';

export const FILTERABLE_ATTRIBUTES = [
  'isPublishedRoot',
  'isHidden',
  'lang',
  'likes',
  'creator',
  TagCategory.Level,
  TagCategory.Discipline,
  TagCategory.ResourceType,
] as const;
