import { InferSelectModel, and, getTableColumns, isNotNull, sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
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

import { AccountType, CompleteMember } from '@graasp/sdk';

import { customNumeric, ltree } from './customTypes';

export const actionRequestExportFormatEnum = pgEnum('action_request_export_format_enum', [
  'json',
  'csv',
]);
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

export const itemPublisheds = pgTable(
  'item_published',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    creatorId: uuid('creator_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    itemPath: ltree('item_path')
      .notNull()
      .references(() => itemsRaw.path, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('IDX_gist_item_published_path').using(
      'gist',
      table.itemPath.asc().nullsLast().op('gist_ltree_ops'),
    ),
    unique('published-item').on(table.itemPath),
  ],
);

export type ItemPublishedRaw = typeof itemPublisheds.$inferSelect;
export type ItemPublishedWithItem = Omit<typeof itemPublisheds.$inferSelect, 'itemPath'> & {
  item: Item;
};
export type ItemPublishedWithItemAndAccount = ItemPublishedWithItem & {
  creator: Member;
};

export const permissionEnum = pgEnum('permission_enum', ['read', 'write', 'admin']);
export const itemMemberships = pgTable(
  'item_membership',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    permission: permissionEnum().notNull(),
    itemPath: ltree('item_path')
      .notNull()
      .references(() => itemsRaw.path, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    creatorId: uuid('creator_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
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
    index('IDX_item_membership_account_id_permission').using(
      'btree',
      table.accountId.asc().nullsLast().op('uuid_ops'),
      table.permission.asc().nullsLast().op('uuid_ops'),
    ),
    unique('item_membership-item-member').on(table.itemPath, table.accountId),
  ],
);

export type ItemMembership = typeof itemMemberships.$inferSelect;
export type ItemMembershipWith = InferSelectModel<typeof itemMemberships>;

export const memberPasswords = pgTable(
  'member_password',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    password: varchar({ length: 100 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
    memberId: uuid('member_id').references(() => accounts.id, {
      onDelete: 'cascade',
    }),
  },
  (table) => [unique('member-password').on(table.memberId)],
);
export type MemberPasswordRaw = typeof memberPasswords.$inferSelect;

export const recycledItemDatas = pgTable(
  'recycled_item_data',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    creatorId: uuid('creator_id'),
    itemPath: ltree('item_path').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accounts.id],
      name: 'FK_3e3650ebd5c49843013429d510a',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.itemPath],
      foreignColumns: [itemsRaw.path],
      name: 'FK_f8a4db4476e3d81e18de5d63c42',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    unique('recycled-item-data').on(table.itemPath),
  ],
);

export const itemLikes = pgTable(
  'item_like',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    creatorId: uuid('creator_id').notNull(),
    itemId: uuid('item_id').notNull(),
  },
  (table) => [
    index('IDX_item_like_item').using('btree', table.itemId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accounts.id],
      name: 'FK_4a56eba1ce30dc93f118a51ff26',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRaw.id],
      name: 'FK_159827eb667d019dc71372d7463',
    }).onDelete('cascade'),
    unique('id').on(table.creatorId, table.itemId),
  ],
);
export type ItemLike = typeof itemLikes.$inferSelect;

export const itemFlags = pgTable(
  'item_flag',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    type: varchar().notNull(),
    creatorId: uuid('creator_id'),
    itemId: uuid('item_id'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRaw.id],
      name: 'FK_b04d0adf4b73d82537c92fa55ea',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accounts.id],
      name: 'FK_bde9b9ab1da1483a71c9b916dd2',
    }).onDelete('set null'),
    unique('item-flag-creator').on(table.type, table.creatorId, table.itemId),
  ],
);
export type ItemFlagCreationDTO = typeof itemLikes.$inferInsert;

export const itemCategories = pgTable(
  'item_category',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    creatorId: uuid('creator_id'),
    itemPath: ltree('item_path').notNull(),
    categoryId: uuid('category_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.categoryId],
      foreignColumns: [categories.id],
      name: 'FK_638552fc7d9a2035c2b53182d8a',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accounts.id],
      name: 'FK_9a34a079b5b24f4396462546d26',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.itemPath],
      foreignColumns: [itemsRaw.path],
      name: 'FK_5681d1785eea699e9cae8818fe0',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    unique('category-item').on(table.itemPath, table.categoryId),
  ],
);

export const categories = pgTable(
  'category',
  {
    id: uuid().notNull().primaryKey().defaultRandom(),
    name: varchar({ length: 50 }).notNull(),
    type: varchar().notNull(),
  },
  (table) => [unique('category-name-type').on(table.name, table.type)],
);

export const chatMessages = pgTable(
  'chat_message',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    itemId: uuid('item_id').notNull(),
    creatorId: uuid('creator_id'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
    body: varchar({ length: 500 }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRaw.id],
      name: 'FK_b31e627ea7a4787672e265a1579',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accounts.id],
      name: 'FK_71fdcb9038eca1b903102bdfd17',
    }).onDelete('set null'),
  ],
);

export type ChatMessageRaw = typeof chatMessages.$inferSelect;
export type ChatMessageWithCreatorAndItem = typeof chatMessages.$inferSelect & {
  creator: Account;
  item: Item;
};
export type ChatMessageCreationDTO = typeof chatMessages.$inferInsert;

export const chatMentions = pgTable(
  'chat_mention',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    messageId: uuid('message_id'),
    accountId: uuid('account_id'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
    status: chatMentionStatusEnum().default('unread').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.messageId],
      foreignColumns: [chatMessages.id],
      name: 'FK_e5199951167b722215127651e7c',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: 'FK_chat_mention_account_id',
    }).onDelete('cascade'),
  ],
);

export const appDatas = pgTable(
  'app_data',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid('account_id').notNull(),
    itemId: uuid('item_id').notNull(),
    data: text().default('{}').notNull(),
    type: varchar({ length: 25 }).notNull(),
    creatorId: uuid('creator_id'),
    visibility: varchar().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('IDX_6079b3bb63c13f815f7dd8d8a2').using(
      'btree',
      table.type.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRaw.id],
      name: 'FK_8c3e2463c67d9865658941c9e2d',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accounts.id],
      name: 'FK_27cb180cb3f372e4cf55302644a',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: 'FK_app_data_account_id',
    }).onDelete('cascade'),
  ],
);

export type AppDataInsertRaw = typeof appDatas.$inferInsert;

export const appActions = pgTable(
  'app_action',
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    accountId: uuid('account_id').notNull(),
    itemId: uuid('item_id').notNull(),
    data: jsonb().default('{}').notNull(),
    type: varchar({ length: 25 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRaw.id],
      name: 'FK_c415fc186dda51fa260d338d776',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: 'FK_app_action_account_id',
    }).onDelete('cascade'),
  ],
);

export const appSettings = pgTable(
  'app_setting',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    itemId: uuid('item_id').notNull(),
    creatorId: uuid('creator_id'),
    name: varchar().notNull(),
    data: text().default('{}').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('IDX_61546c650608c1e68789c64915').using(
      'btree',
      table.itemId.asc().nullsLast().op('text_ops'),
      table.name.asc().nullsLast().op('text_ops'),
    ),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRaw.id],
      name: 'FK_f5922b885e2680beab8add96008',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accounts.id],
      name: 'FK_22d3d051ee6f94932c1373a3d09',
    }).onDelete('set null'),
  ],
);
export type AppSetting = typeof appSettings.$inferSelect;

export const invitations = pgTable(
  'invitation',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    creatorId: uuid('creator_id'),
    itemPath: ltree('item_path')
      .notNull()
      .references(() => itemsRaw.path),
    name: varchar({ length: 100 }),
    email: varchar({ length: 100 }).notNull(),
    permission: permissionEnum().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accounts.id],
      name: 'FK_7ad4a490d5b9f79a677827b641c',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.itemPath],
      foreignColumns: [itemsRaw.path],
      name: 'FK_dc1d92accde1c2fbb7e729e4dcc',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    unique('item-email').on(table.itemPath, table.email),
  ],
);
export type Invitation = typeof invitations.$inferSelect;

export const publishers = pgTable(
  'publisher',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    name: varchar({ length: 250 }).notNull(),
    origins: text().array().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [unique('publisher_name_key').on(table.name)],
);

export const apps = pgTable(
  'app',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    key: uuid().notNull().defaultRandom(),
    name: varchar({ length: 250 }).notNull(),
    description: varchar({ length: 250 }).notNull(),
    url: varchar({ length: 250 }).notNull(),
    publisherId: uuid('publisher_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
    extra: text().default('{}').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.publisherId],
      foreignColumns: [publishers.id],
      name: 'FK_37eb7baab82e11150157ec0b5a6',
    }).onDelete('cascade'),
    unique('app_key_key').on(table.key),
    unique('UQ_f36adbb7b096ceeb6f3e80ad14c').on(table.name),
    unique('app_url_key').on(table.url),
  ],
);

export const itemValidationGroups = pgTable(
  'item_validation_group',
  {
    id: uuid().primaryKey().notNull().defaultRandom(),
    itemId: uuid('item_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRaw.id],
      name: 'FK_a9e83cf5f53c026b774b53d3c60',
    }).onDelete('cascade'),
  ],
);
export type ItemValidationGroup = typeof itemValidationGroups.$inferInsert;

export const itemValidations = pgTable(
  'item_validation',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    itemId: uuid('item_id').notNull(),
    process: varchar().notNull(),
    status: varchar().notNull(),
    result: varchar(),
    itemValidationGroupId: uuid('item_validation_group_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRaw.id],
      name: 'FK_d60969d5e478e7c844532ac4e7f',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.itemValidationGroupId],
      foreignColumns: [itemValidationGroups.id],
      name: 'FK_e92da280941f666acf87baedc65',
    }).onDelete('cascade'),
  ],
);
export type ItemValidation = typeof itemValidations.$inferSelect;

export const itemValidationReviews = pgTable(
  'item_validation_review',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    itemValidationId: uuid('item_validation_id').notNull(),
    reviewerId: uuid('reviewer_id'),
    status: varchar().notNull(),
    reason: varchar(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemValidationId],
      foreignColumns: [itemValidations.id],
      name: 'FK_59fd000835c70c728e525d82950',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.reviewerId],
      foreignColumns: [accounts.id],
      name: 'FK_44bf14fee580ae08702d70e622e',
    }).onDelete('set null'),
  ],
);
export type ItemValidationReview = typeof itemValidationReviews.$inferInsert;

export const itemBookmarks = pgTable(
  'item_favorite',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    memberId: uuid('member_id').notNull(),
    itemId: uuid('item_id').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.memberId],
      foreignColumns: [accounts.id],
      name: 'FK_a169d350392956511697f7e7d38',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRaw.id],
      name: 'FK_10ea93bde287762010695378f94',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    unique('favorite_key').on(table.memberId, table.itemId),
  ],
);
export type ItemBookmark = typeof itemBookmarks.$inferSelect;

export const memberProfiles = pgTable(
  'member_profile',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    bio: varchar({ length: 5000 }),
    visibility: boolean().default(false).notNull(),
    facebookId: varchar({ length: 100 }),
    linkedinId: varchar({ length: 100 }),
    twitterId: varchar({ length: 100 }),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { mode: 'string' }),
    memberId: uuid('member_id')
      .notNull()
      .references(() => accounts.id),
  },
  (table) => [
    index('IDX_91fa43bc5482dc6b00892baf01').using(
      'btree',
      table.memberId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.memberId],
      foreignColumns: [accounts.id],
      name: 'FK_91fa43bc5482dc6b00892baf016',
    }).onDelete('cascade'),
    unique('member-profile').on(table.memberId),
  ],
);

export const shortLinks = pgTable(
  'short_link',
  {
    alias: varchar({ length: 255 }).primaryKey().notNull(),
    platform: shortLinkPlatformEnum().notNull(),
    createdAt: timestamp({ mode: 'string' }).defaultNow().notNull(),
    itemId: uuid('item_id').notNull(),
  },
  (table) => [
    index('IDX_43c8a0471d5e58f99fc9c36b99').using(
      'btree',
      table.itemId.asc().nullsLast().op('uuid_ops'),
    ),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRaw.id],
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

export const actions = pgTable(
  'action',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    view: varchar().notNull(),
    type: varchar().notNull(),
    extra: text().notNull(),
    geolocation: text(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    accountId: uuid('account_id'),
    itemId: uuid('item_id'),
  },
  (table) => [
    index('IDX_1214f6f4d832c402751617361c').using(
      'btree',
      table.itemId.asc().nullsLast().op('uuid_ops'),
    ),
    index('IDX_action_account_id').using('btree', table.accountId.asc().nullsLast().op('uuid_ops')),
    // FIX: We should probably cascade on delete, as there is not reason why we would want to keep the actions around after item deletion
    // Eventually if we wanted to keep a trace of the things that happened to the capsule for debugging and internal analysis,
    // but then we should probably keep them somewhere else and only store user/educational actions in here.
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRaw.id],
      name: 'FK_1214f6f4d832c402751617361c0',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.accountId],
      foreignColumns: [accounts.id],
      name: 'FK_action_account_id',
    }).onDelete('set null'),
  ],
);
export type ActionInsertRaw = typeof actions.$inferInsert;
export type ActionRaw = typeof actions.$inferSelect;
// this is type that matches the automatically linked entities from typeORM,
// we should cehck each usage location to see if including the realtions is necessary or not
export type ActionWithItem = Omit<typeof actions.$inferSelect, 'accountId' | 'itemId'> & {
  item: Item | null;
};
export type ActionWithItemAndAccount = ActionWithItem & {
  account: MinimalAccount | null;
};

export const itemGeolocations = pgTable(
  'item_geolocation',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    lat: doublePrecision().notNull(),
    lng: doublePrecision().notNull(),
    country: varchar({ length: 4 }),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
    itemPath: ltree('item_path').notNull(),
    addressLabel: varchar({ length: 300 }),
    helperLabel: varchar({ length: 300 }),
  },
  (table) => [
    foreignKey({
      columns: [table.itemPath],
      foreignColumns: [itemsRaw.path],
      name: 'FK_66d4b13df4e7765068c8268d719',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    unique('item_geolocation_unique_item').on(table.itemPath),
  ],
);

export const actionRequestExports = pgTable(
  'action_request_export',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    memberId: uuid('member_id').notNull(),
    itemPath: ltree('item_path'),
    format: actionRequestExportFormatEnum().default('json').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.itemPath],
      foreignColumns: [itemsRaw.path],
      name: 'FK_fea823c4374f507a68cf8f926a4',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    foreignKey({
      columns: [table.memberId],
      foreignColumns: [accounts.id],
      name: 'FK_bc85ef3298df8c7974b33081b47',
    }).onDelete('cascade'),
  ],
);
export type ActionRequestExport = typeof actionRequestExports.$inferSelect;

export const itemsRaw = pgTable(
  'item',
  {
    id: uuid().primaryKey().notNull(),
    name: varchar({ length: 500 }).notNull(),
    type: varchar().default('folder').notNull(),
    description: varchar({ length: 5000 }),
    path: ltree('path').notNull(),
    creatorId: uuid('creator_id'),
    // TODO: fix type
    extra: jsonb().notNull(),
    settings: jsonb().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { mode: 'string' }), // HACK: the softdeletion mechanism relies on the deletedAt being null or having a date
    lang: varchar().default('en').notNull(),
    // TODO: failed to parse database type 'tsvector'
    //     searchDocument: unknown('search_document').notNull()
    //       .generatedAlwaysAs(sql`((((((((((((((((((((((((((((((((((((setweight(to_tsvector('simple'::regconfig, (name)::text), 'A'::"char") || ''::tsvector) || setweight(to_tsvector('english'::regconfig, (name)::text), 'A'::"char")) || ''::tsvector) || setweight(to_tsvector('french'::regconfig, (name)::text), 'A'::"char")) || ''::tsvector) ||
    // CASE
    //     WHEN ((lang)::text = 'de'::text) THEN to_tsvector('german'::regconfig, (name)::text)
    //     WHEN ((lang)::text = 'it'::text) THEN to_tsvector('italian'::regconfig, (name)::text)
    //     WHEN ((lang)::text = 'es'::text) THEN to_tsvector('spanish'::regconfig, (name)::text)
    //     ELSE ''::tsvector
    // END) || ''::tsvector) || setweight(to_tsvector('english'::regconfig, (COALESCE(description, ''::character varying))::text), 'B'::"char")) || ''::tsvector) || setweight(to_tsvector('french'::regconfig, (COALESCE(description, ''::character varying))::text), 'B'::"char")) || ''::tsvector) ||
    // CASE
    //     WHEN ((lang)::text = 'de'::text) THEN setweight(to_tsvector('german'::regconfig, (COALESCE(description, ''::character varying))::text), 'B'::"char")
    //     WHEN ((lang)::text = 'it'::text) THEN setweight(to_tsvector('italian'::regconfig, (COALESCE(description, ''::character varying))::text), 'B'::"char")
    //     WHEN ((lang)::text = 'es'::text) THEN setweight(to_tsvector('spanish'::regconfig, (COALESCE(description, ''::character varying))::text), 'B'::"char")
    //     ELSE ''::tsvector
    // END) || ''::tsvector) || setweight(to_tsvector('english'::regconfig, COALESCE(((settings)::jsonb -> 'tags'::text), '{}'::jsonb)), 'C'::"char")) || ''::tsvector) || setweight(to_tsvector('french'::regconfig, COALESCE(((settings)::jsonb -> 'tags'::text), '{}'::jsonb)), 'C'::"char")) || ''::tsvector) ||
    // CASE
    //     WHEN ((lang)::text = 'de'::text) THEN setweight(to_tsvector('german'::regconfig, COALESCE(((settings)::jsonb -> 'tags'::text), '{}'::jsonb)), 'C'::"char")
    //     WHEN ((lang)::text = 'it'::text) THEN setweight(to_tsvector('italian'::regconfig, COALESCE(((settings)::jsonb -> 'tags'::text), '{}'::jsonb)), 'C'::"char")
    //     WHEN ((lang)::text = 'es'::text) THEN setweight(to_tsvector('spanish'::regconfig, COALESCE(((settings)::jsonb -> 'tags'::text), '{}'::jsonb)), 'C'::"char")
    //     ELSE ''::tsvector
    // END) || ''::tsvector) || setweight(to_tsvector('english'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'document'::text) ->> 'content'::text), '{}'::text)), 'D'::"char")) || ''::tsvector) || setweight(to_tsvector('french'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'document'::text) ->> 'content'::text), '{}'::text)), 'D'::"char")) || ''::tsvector) ||
    // CASE
    //     WHEN ((lang)::text = 'de'::text) THEN setweight(to_tsvector('german'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'document'::text) ->> 'content'::text), '{}'::text)), 'D'::"char")
    //     WHEN ((lang)::text = 'it'::text) THEN setweight(to_tsvector('italian'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'document'::text) ->> 'content'::text), '{}'::text)), 'D'::"char")
    //     WHEN ((lang)::text = 'es'::text) THEN setweight(to_tsvector('spanish'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'document'::text) ->> 'content'::text), '{}'::text)), 'D'::"char")
    //     ELSE ''::tsvector
    // END) || ''::tsvector) || setweight(to_tsvector('english'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'file'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")) || ''::tsvector) || setweight(to_tsvector('french'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'file'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")) || ''::tsvector) ||
    // CASE
    //     WHEN ((lang)::text = 'de'::text) THEN setweight(to_tsvector('german'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'file'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")
    //     WHEN ((lang)::text = 'it'::text) THEN setweight(to_tsvector('italian'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'file'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")
    //     WHEN ((lang)::text = 'es'::text) THEN setweight(to_tsvector('spanish'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 'file'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")
    //     ELSE ''::tsvector
    // END) || ''::tsvector) || setweight(to_tsvector('english'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 's3File'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")) || ''::tsvector) || setweight(to_tsvector('french'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 's3File'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")) || ''::tsvector) ||
    // CASE
    //     WHEN ((lang)::text = 'de'::text) THEN setweight(to_tsvector('german'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 's3File'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")
    //     WHEN ((lang)::text = 'it'::text) THEN setweight(to_tsvector('italian'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 's3File'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")
    //     WHEN ((lang)::text = 'es'::text) THEN setweight(to_tsvector('spanish'::regconfig, COALESCE((((replace(extra, '\u0000'::text, ''::text))::jsonb -> 's3File'::text) -> 'content'::text), '{}'::jsonb)), 'D'::"char")
    //     ELSE ''::tsvector
    // END)`),
    order: customNumeric('order'),
  },
  (table) => [
    index('IDX_bdc46717fadc2f04f3093e51fd').using(
      'btree',
      table.creatorId.asc().nullsLast().op('uuid_ops'),
    ),
    // index('IDX_gin_item_search_document').using(
    //   'gin',
    //   table.searchDocument.asc().nullsLast().op('tsvector_ops'),
    // ),
    index('IDX_gist_item_path').using('gist', table.path.asc().nullsLast().op('gist_ltree_ops')),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accounts.id],
      name: 'FK_bdc46717fadc2f04f3093e51fd5',
    }).onDelete('set null'),
    unique('item_path_key1').on(table.path),
  ],
);

// TODO: materialized?? check
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { deletedAt, ...itemColumns } = getTableColumns(itemsRaw);
export const items = pgView('item_view').as((qb) =>
  qb.select(itemColumns).from(itemsRaw).where(isNull(itemsRaw.deletedAt)),
);
export type Item = typeof items.$inferSelect;
export type ItemInsertDTO = typeof itemsRaw.$inferInsert;

export const membershipRequests = pgTable(
  'membership_request',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    memberId: uuid('member_id').notNull(),
    itemId: uuid('item_id').notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.memberId],
      foreignColumns: [accounts.id],
      name: 'FK_membership_request_member_id',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRaw.id],
      name: 'FK_membership_request_item_id',
    }).onDelete('cascade'),
    unique('UQ_membership_request_item-member').on(table.memberId, table.itemId),
  ],
);

export const accounts = pgTable(
  'account',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    name: varchar({ length: 100 }).notNull(),
    email: varchar({ length: 150 }),
    // TODO: notNull added - check for migrations, and db status
    //, '{}', true
    extra: jsonb().$type<CompleteMember['extra']>().default({}).notNull(),
    type: accountTypeEnum().default('individual').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
    userAgreementsDate: timestamp('user_agreements_date', { mode: 'string' }),
    enableSaveActions: boolean('enable_save_actions').default(true),
    lastAuthenticatedAt: timestamp('last_authenticated_at', { mode: 'string' }),
    isValidated: boolean('is_validated').default(false),
    itemLoginSchemaId: uuid('item_login_schema_id').references(
      (): AnyPgColumn => itemLoginSchemas.id,
      {
        onDelete: 'cascade',
      },
    ),
  },
  (table) => [
    index('IDX_account_type').using('btree', table.type.asc().nullsLast().op('text_ops')),
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

export type Account = typeof accounts.$inferSelect;
export type AccountCreationDTO = typeof accounts.$inferInsert;
// minimal account
export type MinimalAccount = {
  id: Account['id'];
  name: Account['name'];
};

// TODO: materialized?? check
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { itemLoginSchemaId, ...membersColumns } = getTableColumns(accounts);
export const membersView = pgView('members_view').as((qb) =>
  qb
    .select(membersColumns)
    .from(accounts)
    .where(and(eq(accounts.type, AccountType.Individual), isNotNull(accounts.email))),
);
export const guestsView = pgView('guests_view').as((qb) =>
  qb
    .select(membersColumns)
    .from(accounts)
    .where(and(eq(accounts.type, AccountType.Guest), isNotNull(accounts.itemLoginSchemaId))),
);
// HACK: Using inferSelect isnce this is a PGView and it does not allow to insert on the view
export type MemberCreationDTO = typeof membersView.$inferSelect & {
  email: string;
};
export type Member = typeof membersView.$inferSelect;

export const guestPasswords = pgTable(
  'guest_password',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    password: varchar({ length: 100 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
    guestId: uuid('guest_id'),
  },
  (table) => [
    foreignKey({
      columns: [table.guestId],
      foreignColumns: [accounts.id],
      name: 'FK_guest_password_guest_id',
    }).onDelete('cascade'),
    unique('UQ_guest_password_guest_id').on(table.guestId),
  ],
);

export const itemLoginSchemas = pgTable(
  'item_login_schema',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    type: varchar({ length: 100 }).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
    itemPath: ltree('item_path')
      .notNull()
      .references(() => itemsRaw.path, {
        onUpdate: 'cascade',
        onDelete: 'cascade',
      }),
    status: varchar({ length: 100 }).default('active').notNull(),
  },
  (table) => [unique('item-login-schema').on(table.itemPath)],
);

export const itemVisibilityEnum = pgEnum('item_visibility_type', ['public', 'hidden']);
export const itemVisibilities = pgTable(
  'item_visibility',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    type: itemVisibilityEnum().notNull(),
    itemPath: ltree('item_path').notNull(),
    creatorId: uuid('creator_id'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('IDX_gist_item_visibility_path').using(
      'gist',
      table.itemPath.asc().nullsLast().op('gist_ltree_ops'),
    ),
    foreignKey({
      columns: [table.creatorId],
      foreignColumns: [accounts.id],
      name: 'FK_item_visibility_creator',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.itemPath],
      foreignColumns: [itemsRaw.path],
      name: 'FK_item_visibility_item',
    })
      .onUpdate('cascade')
      .onDelete('cascade'),
    unique('UQ_item_visibility_item_type').on(table.type, table.itemPath),
  ],
);

export const tags = pgTable(
  'tag',
  {
    id: uuid().primaryKey().defaultRandom().notNull(),
    name: varchar({ length: 255 }).notNull(),
    category: tagCategoryEnum().notNull(),
  },
  (table) => [unique('UQ_tag_name_category').on(table.name, table.category)],
);
export type Tag = typeof tags.$inferSelect;
export type TagCreationDTO = typeof tags.$inferInsert;

export const itemTags = pgTable(
  'item_tag',
  {
    tagId: uuid('tag_id').notNull(),
    itemId: uuid('item_id').notNull(),
  },
  (table) => [
    index('IDX_item_tag_item').using('btree', table.itemId.asc().nullsLast().op('uuid_ops')),
    foreignKey({
      columns: [table.tagId],
      foreignColumns: [tags.id],
      name: 'FK_16ab8afb42f763f7cbaa4bff66a',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.itemId],
      foreignColumns: [itemsRaw.id],
      name: 'FK_39b492fda03c7ac846afe164b58',
    }).onDelete('cascade'),
    primaryKey({
      columns: [table.tagId, table.itemId],
      name: 'PK_a04bb2298e37d95233a0c92347e',
    }),
    unique('UQ_item_tag').on(table.tagId, table.itemId),
  ],
);
