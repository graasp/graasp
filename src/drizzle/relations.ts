import { relations } from 'drizzle-orm/relations';

import {
  accountsTable,
  actionRequestExportsTable,
  actionsTable,
  appActionsTable,
  appDataTable,
  appSettingsTable,
  appsTable,
  categoriesTable,
  chatMentionsTable,
  chatMessagesTable,
  guestPasswordsTable,
  invitationsTable,
  itemBookmarksTable,
  itemCategoriesTable,
  itemFlagsTable,
  itemGeolocationsTable,
  itemLikesTable,
  itemLoginSchemasTable,
  itemMembershipsTable,
  itemTagsTable,
  itemValidationGroupsTable,
  itemValidationReviewsTable,
  itemValidationsTable,
  itemVisibilitiesTable,
  itemsRawTable,
  memberPasswordsTable,
  memberProfilesTable,
  membershipRequestsTable,
  publishedItemsTable,
  publishersTable,
  recycledItemDatasTable,
  shortLinksTable,
  tagsTable,
} from './schema';

export const publishedItemsRelations = relations(publishedItemsTable, ({ one }) => ({
  account: one(accountsTable, {
    fields: [publishedItemsTable.creatorId],
    references: [accountsTable.id],
  }),
  item: one(itemsRawTable, {
    fields: [publishedItemsTable.itemPath],
    references: [itemsRawTable.path],
  }),
}));

export const accountRelations = relations(accountsTable, ({ one, many }) => ({
  publishedItems: many(publishedItemsTable),
  itemMemberships_creatorId: many(itemMembershipsTable, {
    relationName: 'itemMembership_creatorId_account_id',
  }),
  itemMemberships_accountId: many(itemMembershipsTable, {
    relationName: 'itemMembership_accountId_account_id',
  }),
  memberPasswords: many(memberPasswordsTable),
  recycledItemData: many(recycledItemDatasTable),
  itemLikes: many(itemLikesTable),
  itemFlags: many(itemFlagsTable),
  itemCategories: many(itemCategoriesTable),
  chatMessages: many(chatMessagesTable),
  chatMentions: many(chatMentionsTable),
  appData_creatorId: many(appDataTable, {
    relationName: 'appData_creatorId_account_id',
  }),
  appData_accountId: many(appDataTable, {
    relationName: 'appData_accountId_account_id',
  }),
  appActions: many(appActionsTable),
  appSettings: many(appSettingsTable),
  invitations: many(invitationsTable),
  itemValidationReviews: many(itemValidationReviewsTable),
  itemBookmarks: many(itemBookmarksTable),
  memberProfiles: many(memberProfilesTable),
  actions: many(actionsTable),
  actionRequestExports: many(actionRequestExportsTable),
  items: many(itemsRawTable),
  membershipRequests: many(membershipRequestsTable),
  itemLoginSchema: one(itemLoginSchemasTable, {
    fields: [accountsTable.itemLoginSchemaId],
    references: [itemLoginSchemasTable.id],
  }),
  guestPasswords: many(guestPasswordsTable),
  itemVisibilities: many(itemVisibilitiesTable),
}));

export const itemRelations = relations(itemsRawTable, ({ one, many }) => ({
  publishedItems: many(publishedItemsTable),
  itemMemberships: many(itemMembershipsTable),
  recycledItemData: many(recycledItemDatasTable),
  itemLikes: many(itemLikesTable),
  itemFlags: many(itemFlagsTable),
  itemCategories: many(itemCategoriesTable),
  chatMessages: many(chatMessagesTable),
  appData: many(appDataTable),
  appActions: many(appActionsTable),
  appSettings: many(appSettingsTable),
  invitations: many(invitationsTable),
  itemValidationGroups: many(itemValidationGroupsTable),
  itemValidations: many(itemValidationsTable),
  itemBookmarks: many(itemBookmarksTable),
  shortLinks: many(shortLinksTable),
  actions: many(actionsTable),
  itemGeolocations: many(itemGeolocationsTable),
  actionRequestExports: many(actionRequestExportsTable),
  creator: one(accountsTable, {
    fields: [itemsRawTable.creatorId],
    references: [accountsTable.id],
  }),
  membershipRequests: many(membershipRequestsTable),
  itemLoginSchemas: many(itemLoginSchemasTable),
  itemVisibilities: many(itemVisibilitiesTable),
  itemTags: many(itemTagsTable),
}));

export const itemMembershipRelations = relations(itemMembershipsTable, ({ one }) => ({
  creator: one(accountsTable, {
    fields: [itemMembershipsTable.creatorId],
    references: [accountsTable.id],
    relationName: 'itemMembership_creatorId_account_id',
  }),
  item: one(itemsRawTable, {
    fields: [itemMembershipsTable.itemPath],
    references: [itemsRawTable.path],
  }),
  account: one(accountsTable, {
    fields: [itemMembershipsTable.accountId],
    references: [accountsTable.id],
    relationName: 'itemMembership_accountId_account_id',
  }),
}));

export const memberPasswordRelations = relations(memberPasswordsTable, ({ one }) => ({
  member: one(accountsTable, {
    fields: [memberPasswordsTable.memberId],
    references: [accountsTable.id],
  }),
}));

export const recycledItemDataRelations = relations(recycledItemDatasTable, ({ one }) => ({
  account: one(accountsTable, {
    fields: [recycledItemDatasTable.creatorId],
    references: [accountsTable.id],
  }),
  item: one(itemsRawTable, {
    fields: [recycledItemDatasTable.itemPath],
    references: [itemsRawTable.path],
  }),
}));

export const itemLikeRelations = relations(itemLikesTable, ({ one }) => ({
  creator: one(accountsTable, {
    fields: [itemLikesTable.creatorId],
    references: [accountsTable.id],
  }),
  item: one(itemsRawTable, {
    fields: [itemLikesTable.itemId],
    references: [itemsRawTable.id],
  }),
}));

export const itemFlagRelations = relations(itemFlagsTable, ({ one }) => ({
  item: one(itemsRawTable, {
    fields: [itemFlagsTable.itemId],
    references: [itemsRawTable.id],
  }),
  account: one(accountsTable, {
    fields: [itemFlagsTable.creatorId],
    references: [accountsTable.id],
  }),
}));

export const itemCategoriesRelations = relations(itemCategoriesTable, ({ one }) => ({
  categories: one(categoriesTable, {
    fields: [itemCategoriesTable.categoryId],
    references: [categoriesTable.id],
  }),
  account: one(accountsTable, {
    fields: [itemCategoriesTable.creatorId],
    references: [accountsTable.id],
  }),
  item: one(itemsRawTable, {
    fields: [itemCategoriesTable.itemPath],
    references: [itemsRawTable.path],
  }),
}));

export const categoriesRelations = relations(categoriesTable, ({ many }) => ({
  itemCategories: many(itemCategoriesTable),
}));

export const chatMessageRelations = relations(chatMessagesTable, ({ one, many }) => ({
  item: one(itemsRawTable, {
    fields: [chatMessagesTable.itemId],
    references: [itemsRawTable.id],
  }),
  creator: one(accountsTable, {
    fields: [chatMessagesTable.creatorId],
    references: [accountsTable.id],
  }),
  chatMentions: many(chatMentionsTable),
}));

export const chatMentionRelations = relations(chatMentionsTable, ({ one }) => ({
  message: one(chatMessagesTable, {
    fields: [chatMentionsTable.messageId],
    references: [chatMessagesTable.id],
  }),
  account: one(accountsTable, {
    fields: [chatMentionsTable.accountId],
    references: [accountsTable.id],
  }),
}));

export const appDataRelations = relations(appDataTable, ({ one }) => ({
  item: one(itemsRawTable, {
    fields: [appDataTable.itemId],
    references: [itemsRawTable.id],
  }),
  creator: one(accountsTable, {
    fields: [appDataTable.creatorId],
    references: [accountsTable.id],
    relationName: 'appData_creatorId_account_id',
  }),
  account: one(accountsTable, {
    fields: [appDataTable.accountId],
    references: [accountsTable.id],
    relationName: 'appData_accountId_account_id',
  }),
}));

export const appActionRelations = relations(appActionsTable, ({ one }) => ({
  item: one(itemsRawTable, {
    fields: [appActionsTable.itemId],
    references: [itemsRawTable.id],
  }),
  account: one(accountsTable, {
    fields: [appActionsTable.accountId],
    references: [accountsTable.id],
  }),
}));

export const appSettingRelations = relations(appSettingsTable, ({ one }) => ({
  item: one(itemsRawTable, {
    fields: [appSettingsTable.itemId],
    references: [itemsRawTable.id],
  }),
  creator: one(accountsTable, {
    fields: [appSettingsTable.creatorId],
    references: [accountsTable.id],
  }),
}));

export const invitationsRelations = relations(invitationsTable, ({ one }) => ({
  creator: one(accountsTable, {
    fields: [invitationsTable.creatorId],
    references: [accountsTable.id],
  }),
  item: one(itemsRawTable, {
    fields: [invitationsTable.itemPath],
    references: [itemsRawTable.path],
  }),
}));

export const appRelations = relations(appsTable, ({ one }) => ({
  publisher: one(publishersTable, {
    fields: [appsTable.publisherId],
    references: [publishersTable.id],
  }),
}));

export const publisherRelations = relations(publishersTable, ({ many }) => ({
  apps: many(appsTable),
}));

export const itemValidationGroupRelations = relations(
  itemValidationGroupsTable,
  ({ one, many }) => ({
    item: one(itemsRawTable, {
      fields: [itemValidationGroupsTable.itemId],
      references: [itemsRawTable.id],
    }),
    itemValidations: many(itemValidationsTable),
  }),
);

export const itemValidationRelations = relations(itemValidationsTable, ({ one, many }) => ({
  item: one(itemsRawTable, {
    fields: [itemValidationsTable.itemId],
    references: [itemsRawTable.id],
  }),
  itemValidationGroup: one(itemValidationGroupsTable, {
    fields: [itemValidationsTable.itemValidationGroupId],
    references: [itemValidationGroupsTable.id],
  }),
  itemValidationReviews: many(itemValidationReviewsTable),
}));

export const itemValidationReviewRelations = relations(itemValidationReviewsTable, ({ one }) => ({
  itemValidation: one(itemValidationsTable, {
    fields: [itemValidationReviewsTable.itemValidationId],
    references: [itemValidationsTable.id],
  }),
  account: one(accountsTable, {
    fields: [itemValidationReviewsTable.reviewerId],
    references: [accountsTable.id],
  }),
}));

export const itemBookmarkRelations = relations(itemBookmarksTable, ({ one }) => ({
  account: one(accountsTable, {
    fields: [itemBookmarksTable.memberId],
    references: [accountsTable.id],
  }),
  item: one(itemsRawTable, {
    fields: [itemBookmarksTable.itemId],
    references: [itemsRawTable.id],
  }),
}));

export const memberProfileRelations = relations(memberProfilesTable, ({ one }) => ({
  member: one(accountsTable, {
    fields: [memberProfilesTable.memberId],
    references: [accountsTable.id],
  }),
}));

export const shortLinkRelations = relations(shortLinksTable, ({ one }) => ({
  item: one(itemsRawTable, {
    fields: [shortLinksTable.itemId],
    references: [itemsRawTable.id],
  }),
}));

export const actionRelations = relations(actionsTable, ({ one }) => ({
  item: one(itemsRawTable, {
    fields: [actionsTable.itemId],
    references: [itemsRawTable.id],
  }),
  account: one(accountsTable, {
    fields: [actionsTable.accountId],
    references: [accountsTable.id],
  }),
}));

export const itemGeolocationRelations = relations(itemGeolocationsTable, ({ one }) => ({
  item: one(itemsRawTable, {
    fields: [itemGeolocationsTable.itemPath],
    references: [itemsRawTable.path],
  }),
}));

export const actionRequestExportRelations = relations(actionRequestExportsTable, ({ one }) => ({
  item: one(itemsRawTable, {
    fields: [actionRequestExportsTable.itemPath],
    references: [itemsRawTable.path],
  }),
  account: one(accountsTable, {
    fields: [actionRequestExportsTable.memberId],
    references: [accountsTable.id],
  }),
}));

export const membershipRequestRelations = relations(membershipRequestsTable, ({ one }) => ({
  member: one(accountsTable, {
    fields: [membershipRequestsTable.memberId],
    references: [accountsTable.id],
  }),
  item: one(itemsRawTable, {
    fields: [membershipRequestsTable.itemId],
    references: [itemsRawTable.id],
  }),
}));

export const itemLoginSchemaRelations = relations(itemLoginSchemasTable, ({ one, many }) => ({
  accounts: many(accountsTable),
  item: one(itemsRawTable, {
    fields: [itemLoginSchemasTable.itemPath],
    references: [itemsRawTable.path],
  }),
}));

export const guestPasswordRelations = relations(guestPasswordsTable, ({ one }) => ({
  account: one(accountsTable, {
    fields: [guestPasswordsTable.guestId],
    references: [accountsTable.id],
  }),
}));

export const itemVisibilitiesRelations = relations(itemVisibilitiesTable, ({ one }) => ({
  account: one(accountsTable, {
    fields: [itemVisibilitiesTable.creatorId],
    references: [accountsTable.id],
  }),
  item: one(itemsRawTable, {
    fields: [itemVisibilitiesTable.itemPath],
    references: [itemsRawTable.path],
  }),
}));

export const itemTagRelations = relations(itemTagsTable, ({ one }) => ({
  tag: one(tagsTable, {
    fields: [itemTagsTable.tagId],
    references: [tagsTable.id],
  }),
  item: one(itemsRawTable, {
    fields: [itemTagsTable.itemId],
    references: [itemsRawTable.id],
  }),
}));

export const tagRelations = relations(tagsTable, ({ many }) => ({
  itemTags: many(itemTagsTable),
}));
