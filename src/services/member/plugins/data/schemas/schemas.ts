import {
  DATE_TYPE,
  OBJECT_TYPE,
  ONE_OF,
  STRING_TYPE,
  buildRequireExactlyObjectSchema,
} from './utils';

export const externalItemSchema = buildRequireExactlyObjectSchema({
  id: STRING_TYPE,
  name: STRING_TYPE,
  displayName: STRING_TYPE,
});

export const actionSchema = buildRequireExactlyObjectSchema({
  id: STRING_TYPE,
  view: STRING_TYPE, // TODO: ADAPT,
  type: STRING_TYPE, // TODO: ADAPT,
  extra: OBJECT_TYPE,
  createdAt: DATE_TYPE,
  item: externalItemSchema,
});

export const appActionSchema = buildRequireExactlyObjectSchema({
  id: STRING_TYPE,
  data: OBJECT_TYPE,
  type: STRING_TYPE,
  createdAt: DATE_TYPE,
  item: externalItemSchema,
});

export const appDataSchema = buildRequireExactlyObjectSchema({
  id: STRING_TYPE,
  memberId: STRING_TYPE,
  data: OBJECT_TYPE,
  type: STRING_TYPE,
  visibility: STRING_TYPE, // TODO: ADAPT,
  creatorId: STRING_TYPE,
  createdAt: DATE_TYPE,
  updatedAt: DATE_TYPE,
  item: externalItemSchema,
});

export const appSettingSchema = buildRequireExactlyObjectSchema({
  id: STRING_TYPE,
  data: OBJECT_TYPE,
  name: STRING_TYPE,
  createdAt: DATE_TYPE,
  updatedAt: DATE_TYPE,
  item: externalItemSchema,
});

export const externalMemberSchema = buildRequireExactlyObjectSchema({
  name: STRING_TYPE,
});

export const messageSchema = buildRequireExactlyObjectSchema({
  id: STRING_TYPE,
  item: externalItemSchema,
  body: STRING_TYPE,
  updatedAt: DATE_TYPE,
  createdAt: DATE_TYPE,
});

export const externalMessageSchema = buildRequireExactlyObjectSchema({
  id: STRING_TYPE,
  body: STRING_TYPE,
  updatedAt: DATE_TYPE,
  createdAt: DATE_TYPE,
  creator: externalMemberSchema,
});

export const messageMentionSchema = buildRequireExactlyObjectSchema({
  id: STRING_TYPE,
  createdAt: DATE_TYPE,
  updatedAt: DATE_TYPE,
  status: STRING_TYPE,
  message: externalMessageSchema,
});

export const itemSchema = buildRequireExactlyObjectSchema({
  id: STRING_TYPE,
  name: STRING_TYPE,
  type: STRING_TYPE,
  description: STRING_TYPE,
  path: STRING_TYPE,
  creator: externalMemberSchema,
  extra: OBJECT_TYPE,
  settings: OBJECT_TYPE,
  lang: STRING_TYPE,
  displayName: STRING_TYPE,
  createdAt: DATE_TYPE,
  updatedAt: DATE_TYPE,
  deletedAt: ONE_OF([...DATE_TYPE.oneOf, { type: 'null' }]),
});

const categorySchema = buildRequireExactlyObjectSchema({
  id: STRING_TYPE,
  name: STRING_TYPE,
  type: STRING_TYPE,
});

export const itemCategorySchema = buildRequireExactlyObjectSchema({
  id: STRING_TYPE,
  item: externalItemSchema,
  category: categorySchema,
  createdAt: DATE_TYPE,
});

export const itemFavoriteSchema = buildRequireExactlyObjectSchema({
  id: STRING_TYPE,
  item: externalItemSchema,
  createdAt: DATE_TYPE,
});

export const itemLikeSchema = buildRequireExactlyObjectSchema({
  id: STRING_TYPE,
  item: externalItemSchema,
  createdAt: DATE_TYPE,
});
