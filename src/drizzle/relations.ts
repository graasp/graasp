import { relations } from 'drizzle-orm/relations';

import {
  accountsTable,
  actionRequestExports,
  actionsTable,
  appActions,
  appDatas,
  appSettings,
  apps,
  categoriesTable,
  chatMentionsTable,
  chatMessagesTable,
  guestPasswords,
  invitationsTable,
  itemBookmarks,
  itemCategories,
  itemFlags,
  itemGeolocationsTable,
  itemLikes,
  itemLoginSchemas,
  itemMemberships,
  itemTags,
  itemValidationGroups,
  itemValidationReviews,
  itemValidations,
  itemVisibilities,
  itemsRaw,
  memberPasswords,
  memberProfiles,
  membershipRequests,
  publishedItems,
  publishers,
  recycledItemDatas,
  shortLinks,
  tags,
} from './schema.js';

export const publishedItemsRelations = relations(publishedItems, ({ one }) => ({
  account: one(accountsTable, {
    fields: [publishedItems.creatorId],
    references: [accountsTable.id],
  }),
  item: one(itemsRaw, {
    fields: [publishedItems.itemPath],
    references: [itemsRaw.path],
  }),
}));

export const accountRelations = relations(accountsTable, ({ one, many }) => ({
  publishedItems: many(publishedItems),
  itemMemberships_creatorId: many(itemMemberships, {
    relationName: 'itemMembership_creatorId_account_id',
  }),
  itemMemberships_accountId: many(itemMemberships, {
    relationName: 'itemMembership_accountId_account_id',
  }),
  memberPasswords: many(memberPasswords),
  recycledItemData: many(recycledItemDatas),
  itemLikes: many(itemLikes),
  itemFlags: many(itemFlags),
  itemCategories: many(itemCategories),
  chatMessages: many(chatMessagesTable),
  chatMentions: many(chatMentionsTable),
  appData_creatorId: many(appDatas, {
    relationName: 'appData_creatorId_account_id',
  }),
  appData_accountId: many(appDatas, {
    relationName: 'appData_accountId_account_id',
  }),
  appActions: many(appActions),
  appSettings: many(appSettings),
  invitations: many(invitationsTable),
  itemValidationReviews: many(itemValidationReviews),
  itemBookmarks: many(itemBookmarks),
  memberProfiles: many(memberProfiles),
  actions: many(actionsTable),
  actionRequestExports: many(actionRequestExports),
  items: many(itemsRaw),
  membershipRequests: many(membershipRequests),
  itemLoginSchema: one(itemLoginSchemas, {
    fields: [accountsTable.itemLoginSchemaId],
    references: [itemLoginSchemas.id],
  }),
  guestPasswords: many(guestPasswords),
  itemVisibilities: many(itemVisibilities),
}));

export const itemRelations = relations(itemsRaw, ({ one, many }) => ({
  publishedItems: many(publishedItems),
  itemMemberships: many(itemMemberships),
  recycledItemData: many(recycledItemDatas),
  itemLikes: many(itemLikes),
  itemFlags: many(itemFlags),
  itemCategories: many(itemCategories),
  chatMessages: many(chatMessagesTable),
  appData: many(appDatas),
  appActions: many(appActions),
  appSettings: many(appSettings),
  invitations: many(invitationsTable),
  itemValidationGroups: many(itemValidationGroups),
  itemValidations: many(itemValidations),
  itemBookmarks: many(itemBookmarks),
  shortLinks: many(shortLinks),
  actions: many(actionsTable),
  itemGeolocations: many(itemGeolocationsTable),
  actionRequestExports: many(actionRequestExports),
  account: one(accountsTable, {
    fields: [itemsRaw.creatorId],
    references: [accountsTable.id],
  }),
  membershipRequests: many(membershipRequests),
  itemLoginSchemas: many(itemLoginSchemas),
  itemVisibilities: many(itemVisibilities),
  itemTags: many(itemTags),
}));

export const itemMembershipRelations = relations(itemMemberships, ({ one }) => ({
  creator: one(accountsTable, {
    fields: [itemMemberships.creatorId],
    references: [accountsTable.id],
    relationName: 'itemMembership_creatorId_account_id',
  }),
  item: one(itemsRaw, {
    fields: [itemMemberships.itemPath],
    references: [itemsRaw.path],
  }),
  account: one(accountsTable, {
    fields: [itemMemberships.accountId],
    references: [accountsTable.id],
    relationName: 'itemMembership_accountId_account_id',
  }),
}));

export const memberPasswordRelations = relations(memberPasswords, ({ one }) => ({
  member: one(accountsTable, {
    fields: [memberPasswords.memberId],
    references: [accountsTable.id],
  }),
}));

export const recycledItemDataRelations = relations(recycledItemDatas, ({ one }) => ({
  account: one(accountsTable, {
    fields: [recycledItemDatas.creatorId],
    references: [accountsTable.id],
  }),
  item: one(itemsRaw, {
    fields: [recycledItemDatas.itemPath],
    references: [itemsRaw.path],
  }),
}));

export const itemLikeRelations = relations(itemLikes, ({ one }) => ({
  creator: one(accountsTable, {
    fields: [itemLikes.creatorId],
    references: [accountsTable.id],
  }),
  item: one(itemsRaw, {
    fields: [itemLikes.itemId],
    references: [itemsRaw.id],
  }),
}));

export const itemFlagRelations = relations(itemFlags, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [itemFlags.itemId],
    references: [itemsRaw.id],
  }),
  account: one(accountsTable, {
    fields: [itemFlags.creatorId],
    references: [accountsTable.id],
  }),
}));

export const itemCategoriesRelations = relations(itemCategories, ({ one }) => ({
  categories: one(categoriesTable, {
    fields: [itemCategories.categoryId],
    references: [categoriesTable.id],
  }),
  account: one(accountsTable, {
    fields: [itemCategories.creatorId],
    references: [accountsTable.id],
  }),
  item: one(itemsRaw, {
    fields: [itemCategories.itemPath],
    references: [itemsRaw.path],
  }),
}));

export const categoriesRelations = relations(categoriesTable, ({ many }) => ({
  itemCategories: many(itemCategories),
}));

export const chatMessageRelations = relations(chatMessagesTable, ({ one, many }) => ({
  item: one(itemsRaw, {
    fields: [chatMessagesTable.itemId],
    references: [itemsRaw.id],
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

export const appDataRelations = relations(appDatas, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [appDatas.itemId],
    references: [itemsRaw.id],
  }),
  creator: one(accountsTable, {
    fields: [appDatas.creatorId],
    references: [accountsTable.id],
    relationName: 'appData_creatorId_account_id',
  }),
  account: one(accountsTable, {
    fields: [appDatas.accountId],
    references: [accountsTable.id],
    relationName: 'appData_accountId_account_id',
  }),
}));

export const appActionRelations = relations(appActions, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [appActions.itemId],
    references: [itemsRaw.id],
  }),
  account: one(accountsTable, {
    fields: [appActions.accountId],
    references: [accountsTable.id],
  }),
}));

export const appSettingRelations = relations(appSettings, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [appSettings.itemId],
    references: [itemsRaw.id],
  }),
  creator: one(accountsTable, {
    fields: [appSettings.creatorId],
    references: [accountsTable.id],
  }),
}));

export const invitationsRelations = relations(invitationsTable, ({ one }) => ({
  creator: one(accountsTable, {
    fields: [invitationsTable.creatorId],
    references: [accountsTable.id],
  }),
  item: one(itemsRaw, {
    fields: [invitationsTable.itemPath],
    references: [itemsRaw.path],
  }),
}));

export const appRelations = relations(apps, ({ one }) => ({
  publisher: one(publishers, {
    fields: [apps.publisherId],
    references: [publishers.id],
  }),
}));

export const publisherRelations = relations(publishers, ({ many }) => ({
  apps: many(apps),
}));

export const itemValidationGroupRelations = relations(itemValidationGroups, ({ one, many }) => ({
  item: one(itemsRaw, {
    fields: [itemValidationGroups.itemId],
    references: [itemsRaw.id],
  }),
  itemValidations: many(itemValidations),
}));

export const itemValidationRelations = relations(itemValidations, ({ one, many }) => ({
  item: one(itemsRaw, {
    fields: [itemValidations.itemId],
    references: [itemsRaw.id],
  }),
  itemValidationGroup: one(itemValidationGroups, {
    fields: [itemValidations.itemValidationGroupId],
    references: [itemValidationGroups.id],
  }),
  itemValidationReviews: many(itemValidationReviews),
}));

export const itemValidationReviewRelations = relations(itemValidationReviews, ({ one }) => ({
  itemValidation: one(itemValidations, {
    fields: [itemValidationReviews.itemValidationId],
    references: [itemValidations.id],
  }),
  account: one(accountsTable, {
    fields: [itemValidationReviews.reviewerId],
    references: [accountsTable.id],
  }),
}));

export const itemBookmarkRelations = relations(itemBookmarks, ({ one }) => ({
  account: one(accountsTable, {
    fields: [itemBookmarks.memberId],
    references: [accountsTable.id],
  }),
  item: one(itemsRaw, {
    fields: [itemBookmarks.itemId],
    references: [itemsRaw.id],
  }),
}));

export const memberProfileRelations = relations(memberProfiles, ({ one }) => ({
  member: one(accountsTable, {
    fields: [memberProfiles.memberId],
    references: [accountsTable.id],
  }),
}));

export const shortLinkRelations = relations(shortLinks, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [shortLinks.itemId],
    references: [itemsRaw.id],
  }),
}));

export const actionRelations = relations(actionsTable, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [actionsTable.itemId],
    references: [itemsRaw.id],
  }),
  account: one(accountsTable, {
    fields: [actionsTable.accountId],
    references: [accountsTable.id],
  }),
}));

export const itemGeolocationRelations = relations(itemGeolocationsTable, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [itemGeolocationsTable.itemPath],
    references: [itemsRaw.path],
  }),
}));

export const actionRequestExportRelations = relations(actionRequestExports, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [actionRequestExports.itemPath],
    references: [itemsRaw.path],
  }),
  account: one(accountsTable, {
    fields: [actionRequestExports.memberId],
    references: [accountsTable.id],
  }),
}));

export const membershipRequestRelations = relations(membershipRequests, ({ one }) => ({
  member: one(accountsTable, {
    fields: [membershipRequests.memberId],
    references: [accountsTable.id],
  }),
  item: one(itemsRaw, {
    fields: [membershipRequests.itemId],
    references: [itemsRaw.id],
  }),
}));

export const itemLoginSchemaRelations = relations(itemLoginSchemas, ({ one, many }) => ({
  accounts: many(accountsTable),
  item: one(itemsRaw, {
    fields: [itemLoginSchemas.itemPath],
    references: [itemsRaw.path],
  }),
}));

export const guestPasswordRelations = relations(guestPasswords, ({ one }) => ({
  account: one(accountsTable, {
    fields: [guestPasswords.guestId],
    references: [accountsTable.id],
  }),
}));

export const itemVisibilitiesRelations = relations(itemVisibilities, ({ one }) => ({
  account: one(accountsTable, {
    fields: [itemVisibilities.creatorId],
    references: [accountsTable.id],
  }),
  item: one(itemsRaw, {
    fields: [itemVisibilities.itemPath],
    references: [itemsRaw.path],
  }),
}));

export const itemTagRelations = relations(itemTags, ({ one }) => ({
  tag: one(tags, {
    fields: [itemTags.tagId],
    references: [tags.id],
  }),
  item: one(itemsRaw, {
    fields: [itemTags.itemId],
    references: [itemsRaw.id],
  }),
}));

export const tagRelations = relations(tags, ({ many }) => ({
  itemTags: many(itemTags),
}));
