import {
  DATE_TYPE,
  NULLABLE_TYPE,
  NULL_TYPE,
  OBJECT_TYPE,
  ONE_OF,
  STRING_TYPE,
  buildArraySchema,
  buildObjectSchema,
} from '../utils/schema.utils';

export const externalItemSchema = buildObjectSchema({
  id: STRING_TYPE,
  name: STRING_TYPE,
  displayName: STRING_TYPE,
});

export const externalMemberSchema = buildObjectSchema({
  name: STRING_TYPE,
});

export const actionSchema = buildObjectSchema({
  id: STRING_TYPE,
  view: STRING_TYPE,
  type: STRING_TYPE,
  extra: OBJECT_TYPE,
  createdAt: DATE_TYPE,
  item: externalItemSchema,
});
export const actionArraySchema = buildArraySchema(actionSchema);

export const appActionSchema = buildObjectSchema({
  id: STRING_TYPE,
  data: OBJECT_TYPE,
  type: STRING_TYPE,
  createdAt: DATE_TYPE,
  item: externalItemSchema,
});
export const appActionArraySchema = buildArraySchema(appActionSchema);

export const appDataSchema = buildObjectSchema({
  id: STRING_TYPE,
  member: externalMemberSchema,
  data: OBJECT_TYPE,
  type: STRING_TYPE,
  visibility: STRING_TYPE,
  creator: NULLABLE_TYPE(externalMemberSchema),
  createdAt: DATE_TYPE,
  updatedAt: DATE_TYPE,
  item: externalItemSchema,
});
export const appDataArraySchema = buildArraySchema(appDataSchema);

export const appSettingSchema = buildObjectSchema({
  id: STRING_TYPE,
  data: OBJECT_TYPE,
  name: STRING_TYPE,
  createdAt: DATE_TYPE,
  updatedAt: DATE_TYPE,
  item: externalItemSchema,
});
export const appSettingArraySchema = buildArraySchema(appSettingSchema);

export const messageSchema = buildObjectSchema({
  id: STRING_TYPE,
  item: externalItemSchema,
  body: STRING_TYPE,
  updatedAt: DATE_TYPE,
  createdAt: DATE_TYPE,
});
export const messageArraySchema = buildArraySchema(messageSchema);

export const externalMessageSchema = buildObjectSchema({
  id: STRING_TYPE,
  body: STRING_TYPE,
  updatedAt: DATE_TYPE,
  createdAt: DATE_TYPE,
  creator: NULLABLE_TYPE(externalMemberSchema),
});

export const messageMentionSchema = buildObjectSchema({
  id: STRING_TYPE,
  createdAt: DATE_TYPE,
  updatedAt: DATE_TYPE,
  status: STRING_TYPE,
  message: externalMessageSchema,
});
export const messageMentionArraySchema = buildArraySchema(messageMentionSchema);

export const itemSchema = buildObjectSchema({
  id: STRING_TYPE,
  name: STRING_TYPE,
  type: STRING_TYPE,
  description: NULLABLE_TYPE(STRING_TYPE),
  path: STRING_TYPE,
  creator: NULLABLE_TYPE(externalMemberSchema),
  extra: OBJECT_TYPE,
  settings: OBJECT_TYPE,
  lang: STRING_TYPE,
  displayName: STRING_TYPE,
  createdAt: DATE_TYPE,
  updatedAt: DATE_TYPE,
  deletedAt: ONE_OF([...DATE_TYPE.oneOf, NULL_TYPE]),
});
export const itemArraySchema = buildArraySchema(itemSchema);

const categorySchema = buildObjectSchema({
  id: STRING_TYPE,
  name: STRING_TYPE,
  type: STRING_TYPE,
});

export const itemCategorySchema = buildObjectSchema({
  id: STRING_TYPE,
  item: externalItemSchema,
  category: categorySchema,
  createdAt: DATE_TYPE,
});
export const itemCategoryArraySchema = buildArraySchema(itemCategorySchema);

export const itemFavoriteSchema = buildObjectSchema({
  id: STRING_TYPE,
  item: externalItemSchema,
  createdAt: DATE_TYPE,
});
export const itemFavoriteArraySchema = buildArraySchema(itemFavoriteSchema);

export const itemLikeSchema = buildObjectSchema({
  id: STRING_TYPE,
  item: externalItemSchema,
  createdAt: DATE_TYPE,
});
export const itemLikeArraySchema = buildArraySchema(itemLikeSchema);

export const itemMembership = buildObjectSchema({
  id: STRING_TYPE,
  permission: STRING_TYPE,
  item: externalItemSchema,
  createdAt: DATE_TYPE,
  updatedAt: DATE_TYPE,
});
export const itemMembershipArraySchema = buildArraySchema(itemMembership);
