import { and, getTableColumns, isNotNull, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  pgView,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { eq, isNull } from 'drizzle-orm/sql';
import geoip from 'geoip-lite';

import {
  AccountType,
  type CompleteMember,
  type ItemSettings,
  type ItemTypeUnion,
} from '@graasp/sdk';

import { binary, binaryHash, citext, customNumeric, ltree } from './customTypes';

export const actionViewEnum = pgEnum('action_view_enum', [
  'builder',
  'player',
  'library',
  'account',
  'analytics',
  'home',
  'auth',
  'unknown',
]);
export const actionRequestExportFormats = ['json', 'csv'] as const;
export const actionRequestExportFormatEnum = pgEnum(
  'action_request_export_format_enum',
  actionRequestExportFormats,
);
export const itemExportRequestTypeEnum = pgEnum('item_export_request_type_enum', ['raw', 'graasp']);
export const chatMentionStatusEnum = pgEnum('chat_mention_status_enum', ['unread', 'read']);
export const shortLinkPlatformEnum = pgEnum('short_link_platform_enum', [
  'builder',
  'player',
  'library',
]);
export const tagCategoryEnum = pgEnum('tag_category_enum', [
  'level',
  'discipline',
  'resource-type',
]);
export const accountTypeEnum = pgEnum('account_type_enum', ['individual', 'guest']);
export const permissionEnum = pgEnum('permission_enum', ['read', 'write', 'admin']);
export const itemVisibilityEnum = pgEnum('item_visibility_type', ['public', 'hidden']);
export const itemLoginSchemaStatusEnum = pgEnum('item_login_schema_status', [
  'active',
  'freeze',
  'disabled',
]);
export const itemLoginSchemaTypeEnum = pgEnum('item_login_schema_type', [
  'username',
  'username+password',
  'anonymous',
  'anonymous+password',
]);

export const itemValidationProcessEnum = pgEnum('item_validation_process', [
  'bad-words-detection',
  'image-classification',
]);

export const itemValidationStatusEnum = pgEnum('item_validation_status', [
  'success',
  'failure',
  'pending',
  'pending-manual',
]);

export const categoriesTable = pgTable(
  'category',
  {
    id: uuid().notNull().primaryKey().defaultRandom(),
    name: varchar({ length: 50 }).notNull(),
    type: varchar().notNull(),
  },
  (table) => [unique('category-name-type').on(table.name, table.type)],
);

export const publishedItemsTable = pgTable(
  'published_items',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    creatorId: uuid('creator_id').references(() => accountsTable.id, {
      onDelete: 'set null',
    }),
    itemPath: ltree('item_path')
      .notNull()
      .references(() => itemsRawTable.path, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
  },
  (table) => [
    index('IDX_gist_item_published_path').using(
      'gist',
      table.itemPath.asc().nullsLast().op('gist_ltree_ops'),
    ),
    unique('published-item').on(table.itemPath),
  ],
);

export const itemMembershipsTable = pgTable(
  'item_membership',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    permission: permissionEnum().notNull(),
    itemPath: ltree('item_path')
      .notNull()
      .references(() => itemsRawTable.path, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    creatorId: uuid('creator_id').references(() => accountsTable.id, {
      onDelete: 'set null',
    }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accountsTable.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
  },
  (table) => [
    index('IDX_5ac5bdde333fca6bbeaf177ef9').using(
      'btree',
      table.permission.asc().nullsLast().op('text_ops'),
    ),
    index('IDX_d935785e7ecc015ed3ca048ff0').using(
      'btree',
      table.itemPath.asc().nullsLast().op('ltree_ops'),
    ),
    index('IDX_gist_item_membership_path').using(
      'gist',
      table.itemPath.asc().nullsLast().op('gist_ltree_ops'),
    ),
    index('IDX_item_membership_account_id').using(
      'btree',
      table.accountId.asc().nullsLast().op('uuid_ops'),
    ),
    index('IDX_item_membership_creator_id').using(
      'btree',
      table.creatorId.asc().nullsLast().op('uuid_ops'),
    ),
    index('IDX_item_membership_account_id_permission').using(
      'btree',
      table.accountId.asc().nullsLast().op('uuid_ops'),
      table.permission.asc().nullsLast().op('uuid_ops'),
    ),
    unique('item_membership-item-member').on(table.itemPath, table.accountId),
  ],
);

export const memberPasswordsTable = pgTable(
  'member_password',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    password: varchar({ length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
    memberId: uuid('member_id').references(() => accountsTable.id, {
      onDelete: 'cascade',
    }),
  },
  (table) => [unique('member-password').on(table.memberId)],
);
export type MemberPasswordRaw = typeof memberPasswordsTable.$inferSelect;

export const recycledItemDatasTable = pgTable(
  'recycled_item_data',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    creatorId: uuid('creator_id'),
    itemPath: ltree('item_path').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accountsTable.id],
      name: 'FK_3e3650ebd5c49843013429d510a',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.itemPath],
      foreignColumns: [itemsRawTable.path],
      name: 'FK_f8a4db4476e3d81e18de5d63c42',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    unique('recycled-item-data').on(table.itemPath),
    index('IDX_recycled_item_data_item_path').using(
      'gist',
      table.itemPath.asc().nullsLast().op('gist_ltree_ops'),
    ),
    index('IDX_recycled_item_data_created_at').using('btree', table.createdAt.desc()),
  ],
);

export const itemLikesTable = pgTable(
  'item_like',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    creatorId: uuid('creator_id').notNull(),
    itemId: uuid('item_id').notNull(),
  },
  (table) => [
    index('IDX_item_like_item').using('btree', table.itemId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accountsTable.id],
      name: 'FK_4a56eba1ce30dc93f118a51ff26',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_159827eb667d019dc71372d7463',
    }).onDelete('cascade'),
    unique('id').on(table.creatorId, table.itemId),
  ],
);

export const itemFlagsTable = pgTable(
  'item_flag',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    type: varchar().notNull(),
    creatorId: uuid('creator_id'),
    itemId: uuid('item_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_b04d0adf4b73d82537c92fa55ea',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accountsTable.id],
      name: 'FK_bde9b9ab1da1483a71c9b916dd2',
    }).onDelete('set null'),
    unique('item-flag-creator').on(table.type, table.creatorId, table.itemId),
  ],
);
export type ItemFlagCreationDTO = typeof itemFlagsTable.$inferInsert;

export const itemCategoriesTable = pgTable(
  'item_category',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    creatorId: uuid('creator_id'),
    itemPath: ltree('item_path').notNull(),
    categoryId: uuid('category_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [categoriesTable.id],
      name: 'FK_638552fc7d9a2035c2b53182d8a',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accountsTable.id],
      name: 'FK_9a34a079b5b24f4396462546d26',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.itemPath],
      foreignColumns: [itemsRawTable.path],
      name: 'FK_5681d1785eea699e9cae8818fe0',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    index('IDX_item_category_item_path').using(
      'gist',
      table.itemPath.nullsLast().op('gist_ltree_ops'),
    ),
    unique('category-item').on(table.itemPath, table.categoryId),
  ],
);

export const chatMessagesTable = pgTable(
  'chat_message',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    itemId: uuid('item_id').notNull(),
    creatorId: uuid('creator_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
    body: varchar({ length: 500 }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_b31e627ea7a4787672e265a1579',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accountsTable.id],
      name: 'FK_71fdcb9038eca1b903102bdfd17',
    }).onDelete('set null'),
  ],
);

export const chatMentionsTable = pgTable(
  'chat_mention',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    messageId: uuid('message_id')
      .references(() => chatMessagesTable.id)
      .notNull(),
    accountId: uuid('account_id')
      .references(() => accountsTable.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
    status: chatMentionStatusEnum().default('unread').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [chatMessagesTable.id],
      name: 'FK_e5199951167b722215127651e7c',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accountsTable.id],
      name: 'FK_chat_mention_account_id',
    }).onDelete('cascade'),
  ],
);

export const appDataTable = pgTable(
  'app_data',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid('account_id').notNull(),
    itemId: uuid('item_id').notNull(),
    data: jsonb().$type<{ [key: string]: unknown }>().default({}).notNull(),
    type: varchar({ length: 25 }).notNull(),
    creatorId: uuid('creator_id'),
    visibility: varchar().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
  },
  (table) => [
    index('IDX_6079b3bb63c13f815f7dd8d8a2').using(
      'btree',
      table.type.asc().nullsLast().op('text_ops'),
    ),
    index('IDX_app_data_item_id').using('btree', table.itemId.asc().nullsLast().op('uuid_ops')),
    index('IDX_app_data_account_id').using(
      'btree',
      table.accountId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_8c3e2463c67d9865658941c9e2d',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accountsTable.id],
      name: 'FK_27cb180cb3f372e4cf55302644a',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accountsTable.id],
      name: 'FK_app_data_account_id',
    }).onDelete('cascade'),
  ],
);

export const appActionsTable = pgTable(
  'app_action',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid('account_id').notNull(),
    itemId: uuid('item_id').notNull(),
    data: jsonb().$type<object>().default({}).notNull(),
    type: varchar({ length: 25 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_c415fc186dda51fa260d338d776',
    }).onDelete('cascade'),
    index('IDX_app_action_item_id').using('btree', table.itemId.nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accountsTable.id],
      name: 'FK_app_action_account_id',
    }).onDelete('cascade'),
    index('IDX_app_action_account_id').using('btree', table.accountId.nullsLast().op('uuid_ops')),
  ],
);

export const appSettingsTable = pgTable(
  'app_setting',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    itemId: uuid('item_id').notNull(),
    creatorId: uuid('creator_id'),
    name: varchar().notNull(),
    data: jsonb().$type<object>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
  },
  (table) => [
    index('IDX_61546c650608c1e68789c64915').using(
      'btree',
      table.itemId.asc().nullsLast().op('text_ops'),
      table.name.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_f5922b885e2680beab8add96008',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accountsTable.id],
      name: 'FK_22d3d051ee6f94932c1373a3d09',
    }).onDelete('set null'),
  ],
);

export const invitationsTable = pgTable(
  'invitation',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    creatorId: uuid('creator_id').references(() => accountsTable.id),
    itemPath: ltree('item_path').notNull(),
    name: varchar({ length: 100 }),
    email: varchar({ length: 100 }).notNull(),
    permission: permissionEnum().default('read').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
  },
  (table) => [
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accountsTable.id],
      name: 'FK_7ad4a490d5b9f79a677827b641c',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.itemPath],
      foreignColumns: [itemsRawTable.path],
      name: 'FK_invitation_item_path',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    index('IDX_invitation_item_path').using(
      'gist',
      table.itemPath.nullsLast().op('gist_ltree_ops'),
    ),
    unique('item-email').on(table.itemPath, table.email),
  ],
);

export const publishersTable = pgTable(
  'publishers',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    name: varchar({ length: 250 }).notNull(),
    origins: text().array().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
  },
  (table) => [unique('publisher_name_key').on(table.name)],
);

export const appsTable = pgTable(
  'apps',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    key: uuid().notNull().defaultRandom(),
    name: varchar({ length: 250 }).notNull(),
    description: varchar({ length: 250 }).notNull(),
    url: varchar({ length: 250 }).notNull(),
    thumbnail: varchar({ length: 255 }).notNull(),
    publisherId: uuid('publisher_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
  },
  (table) => [
    foreignKey({
      columns: [table.publisherId],
      foreignColumns: [publishersTable.id],
      name: 'apps_publisher_id_fk',
    }).onDelete('cascade'),
    unique('app_key_key').on(table.key),
    unique('UQ_f36adbb7b096ceeb6f3e80ad14c').on(table.name),
    unique('app_url_key').on(table.url),
  ],
);

export const itemValidationGroupsTable = pgTable(
  'item_validation_group',
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    itemId: uuid('item_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_a9e83cf5f53c026b774b53d3c60',
    }).onDelete('cascade'),
    index('IDX_item_validation_group_item_id').using(
      'btree',
      table.itemId.nullsLast().op('uuid_ops'),
    ),
  ],
);

export const itemValidationsTable = pgTable(
  'item_validation',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    itemId: uuid('item_id').notNull(),
    process: itemValidationProcessEnum().notNull(),
    status: itemValidationStatusEnum().notNull(),
    result: varchar(),
    itemValidationGroupId: uuid('item_validation_group_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_d60969d5e478e7c844532ac4e7f',
    }).onDelete('cascade'),
    index('IDX_item_validation_item_id').using('btree', table.itemId.nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.itemValidationGroupId],
      foreignColumns: [itemValidationGroupsTable.id],
      name: 'FK_e92da280941f666acf87baedc65',
    }).onDelete('cascade'),
    index('IDX_item_validation_item_validation_group_id').using(
      'btree',
      table.itemValidationGroupId.nullsLast().op('uuid_ops'),
    ),
  ],
);

export const itemValidationReviewsTable = pgTable(
  'item_validation_review',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    itemValidationId: uuid('item_validation_id').notNull(),
    reviewerId: uuid('reviewer_id'),
    status: varchar().notNull(),
    reason: varchar(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
  },
  (table) => [
    foreignKey({
      columns: [table.itemValidationId],
      foreignColumns: [itemValidationsTable.id],
      name: 'FK_59fd000835c70c728e525d82950',
    }).onDelete('cascade'),
    index('IDX_item_validation_review_item_validation_id').using(
      'btree',
      table.itemValidationId.nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.reviewerId],
      foreignColumns: [accountsTable.id],
      name: 'FK_44bf14fee580ae08702d70e622e',
    }).onDelete('set null'),
  ],
);

export const itemBookmarksTable = pgTable(
  'item_favorite',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    memberId: uuid('member_id').notNull(),
    itemId: uuid('item_id').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.memberId],
      foreignColumns: [accountsTable.id],
      name: 'FK_a169d350392956511697f7e7d38',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_10ea93bde287762010695378f94',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    unique('favorite_key').on(table.memberId, table.itemId),
  ],
);

export const memberProfilesTable = pgTable(
  'member_profile',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    bio: varchar({ length: 5000 }),
    visibility: boolean().default(false).notNull(),
    facebookId: varchar({ length: 100 }),
    linkedinId: varchar({ length: 100 }),
    twitterId: varchar({ length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
    memberId: uuid('member_id')
      .notNull()
      .references(() => accountsTable.id),
  },
  (table) => [
    index('IDX_91fa43bc5482dc6b00892baf01').using(
      'btree',
      table.memberId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.memberId],
      foreignColumns: [accountsTable.id],
      name: 'FK_91fa43bc5482dc6b00892baf016',
    }).onDelete('cascade'),
    unique('member-profile').on(table.memberId),
  ],
);

export const shortLinksTable = pgTable(
  'short_link',
  {
    alias: varchar({ length: 255 }).primaryKey().notNull(),
    platform: shortLinkPlatformEnum().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    itemId: uuid('item_id').notNull(),
  },
  (table) => [
    index('IDX_43c8a0471d5e58f99fc9c36b99').using(
      'btree',
      table.itemId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_43c8a0471d5e58f99fc9c36b991',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    unique('UQ_859a3384cadaa460b84e04e5375').on(table.platform, table.itemId),
    check(
      'CHK_200ef28b2168aaf1e36b6896fc',
      sql`(length((alias)::text) >= 6) AND (length((alias)::text) <= 255) AND ((alias)::text ~ '^[a-zA-Z0-9-]*$'::text)`,
    ),
  ],
);

export const actionsTable = pgTable(
  'action',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    view: actionViewEnum().default('unknown').notNull(),
    type: varchar().notNull(),
    extra: jsonb().$type<object>().default({}).notNull(),
    geolocation: jsonb().$type<geoip.Lookup>(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    accountId: uuid('account_id'),
    itemId: uuid('item_id'),
  },
  (table) => [
    index('IDX_1214f6f4d832c402751617361c').using(
      'btree',
      table.itemId.asc().nullsLast().op('uuid_ops'),
    ),
    index('IDX_action_account_id').using('btree', table.accountId.asc().nullsLast().op('uuid_ops')),
    // FIXME: We should probably cascade on delete, as there is no reason why we would want to keep the actions around after item deletion
    // Eventually if we wanted to keep a trace of the things that happened to the capsule for debugging and internal analysis,
    // but then we should probably keep them somewhere else and only store user/educational actions in here.
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_1214f6f4d832c402751617361c0',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accountsTable.id],
      name: 'FK_action_account_id',
    }).onDelete('set null'),
  ],
);

export const itemGeolocationsTable = pgTable(
  'item_geolocation',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    lat: doublePrecision().notNull(),
    lng: doublePrecision().notNull(),
    country: varchar({ length: 4 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
    itemPath: ltree('item_path').notNull(),
    addressLabel: varchar({ length: 300 }),
    helperLabel: varchar({ length: 300 }),
  },
  (table) => [
    foreignKey({
      columns: [table.itemPath],
      foreignColumns: [itemsRawTable.path],
      name: 'FK_66d4b13df4e7765068c8268d719',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    unique('item_geolocation_unique_item').on(table.itemPath),
  ],
);

export const actionRequestExportsTable = pgTable(
  'action_request_export',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    memberId: uuid('member_id').notNull(),
    itemPath: ltree('item_path'),
    format: actionRequestExportFormatEnum().default('json').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemPath],
      foreignColumns: [itemsRawTable.path],
      name: 'FK_fea823c4374f507a68cf8f926a4',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      columns: [table.memberId],
      foreignColumns: [accountsTable.id],
      name: 'FK_bc85ef3298df8c7974b33081b47',
    }).onDelete('cascade'),
  ],
);

export const itemExportRequestsTable = pgTable('item_export_request', {
  id: uuid().primaryKey().defaultRandom().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  memberId: uuid('member_id').references(() => accountsTable.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').references(() => itemsRawTable.id, { onDelete: 'cascade' }),
  type: itemExportRequestTypeEnum().notNull(),
});

export const itemsRawTable = pgTable(
  'item',
  {
    id: uuid().primaryKey().notNull(),
    name: varchar({ length: 500 }).notNull(),
    type: varchar().$type<ItemTypeUnion>().default('folder').notNull(),
    description: varchar({ length: 5000 }),
    path: ltree('path').notNull(),
    creatorId: uuid('creator_id'),
    // TODO: fix type
    extra: jsonb().$type<object>().default({}).notNull(),
    settings: jsonb().$type<ItemSettings>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }), // HACK: the softdeletion mechanism relies on the deletedAt being null or having a date
    lang: varchar().default('en').notNull(),

    order: customNumeric('order'),
  },
  (table) => [
    index('IDX_bdc46717fadc2f04f3093e51fd').using(
      'btree',
      table.creatorId.asc().nullsLast().op('uuid_ops'),
    ),
    index('IDX_gist_item_path').using('gist', table.path.asc().nullsLast().op('gist_ltree_ops')),
    index('IDX_item_deleted_at').using('btree', table.deletedAt.asc().nullsLast()),
    // allow the use of the view without loosing perf
    index('IDX_gist_item_path_deleted_at')
      .using('gist', table.path.asc().nullsLast().op('gist_ltree_ops'))
      .where(isNull(table.deletedAt)),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accountsTable.id],
      name: 'FK_bdc46717fadc2f04f3093e51fd5',
    }).onDelete('set null'),
    unique('item_path_key1').on(table.path),
  ],
);

export const { deletedAt: _deletedAt, ...itemColumns } = getTableColumns(itemsRawTable);
export const items = pgView('item_view').as((qb) =>
  qb.select(itemColumns).from(itemsRawTable).where(isNull(itemsRawTable.deletedAt)),
);

export const membershipRequestsTable = pgTable(
  'membership_request',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    memberId: uuid('member_id').notNull(),
    itemId: uuid('item_id').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.memberId],
      foreignColumns: [accountsTable.id],
      name: 'FK_membership_request_member_id',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_membership_request_item_id',
    }).onDelete('cascade'),
    unique('UQ_membership_request_item-member').on(table.memberId, table.itemId),
  ],
);

export const accountsTable = pgTable(
  'account',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    name: varchar({ length: 100 }).notNull(),
    email: varchar({ length: 150 }),
    extra: jsonb().$type<CompleteMember['extra']>().default({}).notNull(),
    type: accountTypeEnum().default('individual').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
    userAgreementsDate: timestamp('user_agreements_date', { withTimezone: true, mode: 'string' }),
    enableSaveActions: boolean('enable_save_actions').default(true),
    lastAuthenticatedAt: timestamp('last_authenticated_at', { withTimezone: true, mode: 'string' }),
    isValidated: boolean('is_validated').default(false),
    itemLoginSchemaId: uuid('item_login_schema_id').references(
      (): AnyPgColumn => itemLoginSchemasTable.id,
      {
        onDelete: 'cascade',
      },
    ),
  },
  (table) => [
    index('IDX_account_type').using('btree', table.type.asc().nullsLast().op('enum_ops')),
    unique('UQ_account_name_item_login_schema_id').on(table.name, table.itemLoginSchemaId),
    unique('member_email_key1').on(table.email),
    check(
      'CHK_account_is_validated',
      sql`(is_validated IS NOT NULL) OR ((type)::text <> 'individual'::text)`,
    ),
    check('CHK_account_email', sql`(email IS NOT NULL) OR ((type)::text <> 'individual'::text)`),
    check('CHK_account_extra', sql`(extra IS NOT NULL) OR ((type)::text <> 'individual'::text)`),
    check(
      'CHK_account_enable_save_actions',
      sql`(enable_save_actions IS NOT NULL) OR ((type)::text <> 'individual'::text)`,
    ),
  ],
);

// TODO: materialized?? check
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { itemLoginSchemaId, ...membersColumns } = getTableColumns(accountsTable);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { email, userAgreementsDate, enableSaveActions, ...guestColumns } =
  getTableColumns(accountsTable);
export const membersView = pgView('members_view').as((qb) =>
  qb
    .select(membersColumns)
    .from(accountsTable)
    .where(and(eq(accountsTable.type, AccountType.Individual), isNotNull(accountsTable.email))),
);
export const guestsView = pgView('guests_view').as((qb) =>
  qb
    .select(guestColumns)
    .from(accountsTable)
    .where(
      and(eq(accountsTable.type, AccountType.Guest), isNotNull(accountsTable.itemLoginSchemaId)),
    ),
);

export const guestPasswordsTable = pgTable(
  'guest_password',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    password: varchar({ length: 100 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
    guestId: uuid('guest_id'),
  },
  (table) => [
    foreignKey({
      columns: [table.guestId],
      foreignColumns: [accountsTable.id],
      name: 'FK_guest_password_guest_id',
    }).onDelete('cascade'),
    unique('UQ_guest_password_guest_id').on(table.guestId),
  ],
);

export const itemLoginSchemasTable = pgTable(
  'item_login_schema',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    type: itemLoginSchemaTypeEnum().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull()
      .$onUpdate(() => sql.raw('DEFAULT')),
    itemPath: ltree('item_path')
      .notNull()
      .references(() => itemsRawTable.path, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    status: itemLoginSchemaStatusEnum().default('active').notNull(),
  },
  (table) => [unique('item-login-schema').on(table.itemPath)],
);

export const itemVisibilitiesTable = pgTable(
  'item_visibility',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    type: itemVisibilityEnum().notNull(),
    itemPath: ltree('item_path').notNull(),
    creatorId: uuid('creator_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('IDX_gist_item_visibility_path').using(
      'gist',
      table.itemPath.asc().nullsLast().op('gist_ltree_ops'),
    ),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accountsTable.id],
      name: 'FK_item_visibility_creator',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.itemPath],
      foreignColumns: [itemsRawTable.path],
      name: 'FK_item_visibility_item',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    unique('UQ_item_visibility_item_type').on(table.type, table.itemPath),
  ],
);

/**
 * Tags and item tags:
 * Describes the association between concepts, fields, so that users can find related collections
 */
export const tagsTable = pgTable(
  'tag',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    name: varchar({ length: 255 }).notNull(),
    category: tagCategoryEnum().notNull(),
  },
  (table) => [unique('UQ_tag_name_category').on(table.name, table.category)],
);

export const itemTagsTable = pgTable(
  'item_tag',
  {
    tagId: uuid('tag_id').notNull(),
    itemId: uuid('item_id').notNull(),
  },
  (table) => [
    index('IDX_item_tag_item').using('btree', table.itemId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.tagId],
      foreignColumns: [tagsTable.id],
      name: 'FK_16ab8afb42f763f7cbaa4bff66a',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_39b492fda03c7ac846afe164b58',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.tagId, table.itemId],
      name: 'PK_a04bb2298e37d95233a0c92347e',
    }),
    unique('UQ_item_tag').on(table.tagId, table.itemId),
  ],
);

export const maintenanceTable = pgTable('maintenance', {
  slug: varchar({ length: 100 }).notNull().primaryKey().unique('UQ_maintenance_slug'),
  startAt: timestamp('start_at', { withTimezone: true, mode: 'string' }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true, mode: 'string' }).notNull(),
});

export const pageUpdateTable = pgTable(
  'page_update',
  {
    itemId: uuid('item_id').notNull(),
    update: binaryHash().notNull(),
    clock: integer().notNull(),
  },
  (table) => [
    index('IDX_page_item_id').using('btree', table.itemId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRawTable.id],
      name: 'FK_page_update_item_id',
    }).onDelete('cascade'),
  ],
);

/**
 * Migrations table for Phoenix
 * This table stores the migrations that have been run by phoenix.
 * It is currently managed by Drizzle. We manually insert the migration version and timstamp to satisfy Phoenix.
 * We ensure that the changes that Phoenix wants to make to the database are carried out by Drizzle.
 */
export const schemaMigrations = pgTable('schema_migrations', {
  /**
   * The unique "name" of the migration. This is the creation timestamp of the migration file: e.g: 20250901110819
   */
  version: bigint('version', { mode: 'number' }).primaryKey().notNull(),
  /**
   * The timestamp of the migraiton insertion (when it was run on the database)
   */
  insertedAt: timestamp('inserted_at', { precision: 0 }),
});

// users table for the phoenix admin pannel
export const adminsTable = pgTable(
  'admins',
  {
    id: uuid().primaryKey().notNull(),
    email: citext().unique().notNull(),
    hashed_password: varchar({ length: 255 }),
    confirmedAt: timestamp('confirmed_at', { withTimezone: false, precision: 0 }),
    createdAt: timestamp('created_at', { withTimezone: false, precision: 0 }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: false, precision: 0 }).notNull(),
  },
  (table) => [index('admins_email_index').using('btree', table.email)],
);

// users tokens used for authentication
export const adminsTokens = pgTable(
  'admins_tokens',
  {
    id: uuid('id').primaryKey().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => adminsTable.id, { onDelete: 'cascade' }),
    token: binary('token').notNull(),
    context: varchar('context', { length: 255 }).notNull(),
    sentTo: varchar('sent_to', { length: 255 }),
    authenticatedAt: timestamp('authenticated_at', { precision: 0 }),
    createdAt: timestamp('created_at', { precision: 0 }).notNull(),
  },
  (table) => [
    unique('admins_tokens_context_token_index').on(table.context, table.token),
    index('admins_tokens_user_id_index').using('btree', table.userId.op('uuid_ops')),
  ],
);

export const removalNotices = pgTable(
  'publication_removal_notices',
  {
    id: uuid('id').primaryKey().notNull(),
    publicationName: varchar('publication_name', { length: 255 }),
    reason: text('reason'),
    itemId: uuid('item_id').references(() => itemsRawTable.id, { onDelete: 'cascade' }),
    creatorId: uuid('creator_id').references(() => adminsTable.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { precision: 0 }).notNull(),
  },
  (table) => [
    index('publication_removal_notices_item_id_index').using('btree', table.itemId.op('uuid_ops')),
  ],
);
