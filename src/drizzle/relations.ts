import { relations } from 'drizzle-orm/relations';

import {
  accounts,
  actionRequestExports,
  actions,
  appActions,
  appDatas,
  appSettings,
  apps,
  categories,
  chatMentions,
  chatMessages,
  guestPasswords,
  invitations,
  itemBookmarks,
  itemCategories,
  itemFlags,
  itemGeolocations,
  itemLikes,
  itemLoginSchemas,
  itemMemberships,
  itemPublisheds,
  itemTags,
  itemValidationGroups,
  itemValidationReviews,
  itemValidations,
  itemVisibilities,
  itemsRaw,
  memberPasswords,
  memberProfiles,
  membershipRequests,
  publishers,
  recycledItemDatas,
  shortLinks,
  tags,
} from './schema';

export const itemPublishedRelations = relations(itemPublisheds, ({ one }) => ({
  account: one(accounts, {
    fields: [itemPublisheds.creatorId],
    references: [accounts.id],
  }),
  item: one(itemsRaw, {
    fields: [itemPublisheds.itemPath],
    references: [itemsRaw.path],
  }),
}));

export const accountRelations = relations(accounts, ({ one, many }) => ({
  itemPublisheds: many(itemPublisheds),
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
  chatMessages: many(chatMessages),
  chatMentions: many(chatMentions),
  appData_creatorId: many(appDatas, {
    relationName: 'appData_creatorId_account_id',
  }),
  appData_accountId: many(appDatas, {
    relationName: 'appData_accountId_account_id',
  }),
  appActions: many(appActions),
  appSettings: many(appSettings),
  invitationss: many(invitations),
  itemValidationReviews: many(itemValidationReviews),
  itemBookmarks: many(itemBookmarks),
  memberProfiles: many(memberProfiles),
  actions: many(actions),
  actionRequestExports: many(actionRequestExports),
  items: many(itemsRaw),
  membershipRequests: many(membershipRequests),
  itemLoginSchema: one(itemLoginSchemas, {
    fields: [accounts.itemLoginSchemaId],
    references: [itemLoginSchemas.id],
  }),
  guestPasswords: many(guestPasswords),
  itemVisibilities: many(itemVisibilities),
}));

export const itemRelations = relations(itemsRaw, ({ one, many }) => ({
  itemPublisheds: many(itemPublisheds),
  itemMemberships: many(itemMemberships),
  recycledItemData: many(recycledItemDatas),
  itemLikes: many(itemLikes),
  itemFlags: many(itemFlags),
  itemCategories: many(itemCategories),
  chatMessages: many(chatMessages),
  appData: many(appDatas),
  appActions: many(appActions),
  appSettings: many(appSettings),
  invitationss: many(invitations),
  itemValidationGroups: many(itemValidationGroups),
  itemValidations: many(itemValidations),
  itemBookmarks: many(itemBookmarks),
  shortLinks: many(shortLinks),
  actions: many(actions),
  itemGeolocations: many(itemGeolocations),
  actionRequestExports: many(actionRequestExports),
  account: one(accounts, {
    fields: [itemsRaw.creatorId],
    references: [accounts.id],
  }),
  membershipRequests: many(membershipRequests),
  itemLoginSchemas: many(itemLoginSchemas),
  itemVisibilities: many(itemVisibilities),
  itemTags: many(itemTags),
}));

export const itemMembershipRelations = relations(itemMemberships, ({ one }) => ({
  creator: one(accounts, {
    fields: [itemMemberships.creatorId],
    references: [accounts.id],
    relationName: 'itemMembership_creatorId_account_id',
  }),
  item: one(itemsRaw, {
    fields: [itemMemberships.itemPath],
    references: [itemsRaw.path],
  }),
  account: one(accounts, {
    fields: [itemMemberships.accountId],
    references: [accounts.id],
    relationName: 'itemMembership_accountId_account_id',
  }),
}));

export const memberPasswordRelations = relations(memberPasswords, ({ one }) => ({
  account: one(accounts, {
    fields: [memberPasswords.memberId],
    references: [accounts.id],
  }),
}));

export const recycledItemDataRelations = relations(recycledItemDatas, ({ one }) => ({
  account: one(accounts, {
    fields: [recycledItemDatas.creatorId],
    references: [accounts.id],
  }),
  item: one(itemsRaw, {
    fields: [recycledItemDatas.itemPath],
    references: [itemsRaw.path],
  }),
}));

export const itemLikeRelations = relations(itemLikes, ({ one }) => ({
  account: one(accounts, {
    fields: [itemLikes.creatorId],
    references: [accounts.id],
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
  account: one(accounts, {
    fields: [itemFlags.creatorId],
    references: [accounts.id],
  }),
}));

export const itemCategoriesRelations = relations(itemCategories, ({ one }) => ({
  categories: one(categories, {
    fields: [itemCategories.categoryId],
    references: [categories.id],
  }),
  account: one(accounts, {
    fields: [itemCategories.creatorId],
    references: [accounts.id],
  }),
  item: one(itemsRaw, {
    fields: [itemCategories.itemPath],
    references: [itemsRaw.path],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  itemCategories: many(itemCategories),
}));

export const chatMessageRelations = relations(chatMessages, ({ one, many }) => ({
  item: one(itemsRaw, {
    fields: [chatMessages.itemId],
    references: [itemsRaw.id],
  }),
  account: one(accounts, {
    fields: [chatMessages.creatorId],
    references: [accounts.id],
  }),
  chatMentions: many(chatMentions),
}));

export const chatMentionRelations = relations(chatMentions, ({ one }) => ({
  chatMessage: one(chatMessages, {
    fields: [chatMentions.messageId],
    references: [chatMessages.id],
  }),
  account: one(accounts, {
    fields: [chatMentions.accountId],
    references: [accounts.id],
  }),
}));

export const appDataRelations = relations(appDatas, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [appDatas.itemId],
    references: [itemsRaw.id],
  }),
  account_creatorId: one(accounts, {
    fields: [appDatas.creatorId],
    references: [accounts.id],
    relationName: 'appData_creatorId_account_id',
  }),
  account_accountId: one(accounts, {
    fields: [appDatas.accountId],
    references: [accounts.id],
    relationName: 'appData_accountId_account_id',
  }),
}));

export const appActionRelations = relations(appActions, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [appActions.itemId],
    references: [itemsRaw.id],
  }),
  account: one(accounts, {
    fields: [appActions.accountId],
    references: [accounts.id],
  }),
}));

export const appSettingRelations = relations(appSettings, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [appSettings.itemId],
    references: [itemsRaw.id],
  }),
  account: one(accounts, {
    fields: [appSettings.creatorId],
    references: [accounts.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  account: one(accounts, {
    fields: [invitations.creatorId],
    references: [accounts.id],
  }),
  item: one(itemsRaw, {
    fields: [invitations.itemPath],
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
  account: one(accounts, {
    fields: [itemValidationReviews.reviewerId],
    references: [accounts.id],
  }),
}));

export const itemBookmarkRelations = relations(itemBookmarks, ({ one }) => ({
  account: one(accounts, {
    fields: [itemBookmarks.memberId],
    references: [accounts.id],
  }),
  item: one(itemsRaw, {
    fields: [itemBookmarks.itemId],
    references: [itemsRaw.id],
  }),
}));

export const memberProfileRelations = relations(memberProfiles, ({ one }) => ({
  member: one(accounts, {
    fields: [memberProfiles.memberId],
    references: [accounts.id],
  }),
}));

export const shortLinkRelations = relations(shortLinks, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [shortLinks.itemId],
    references: [itemsRaw.id],
  }),
}));

export const actionRelations = relations(actions, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [actions.itemId],
    references: [itemsRaw.id],
  }),
  account: one(accounts, {
    fields: [actions.accountId],
    references: [accounts.id],
  }),
}));

export const itemGeolocationRelations = relations(itemGeolocations, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [itemGeolocations.itemPath],
    references: [itemsRaw.path],
  }),
}));

export const actionRequestExportRelations = relations(actionRequestExports, ({ one }) => ({
  item: one(itemsRaw, {
    fields: [actionRequestExports.itemPath],
    references: [itemsRaw.path],
  }),
  account: one(accounts, {
    fields: [actionRequestExports.memberId],
    references: [accounts.id],
  }),
}));

export const membershipRequestRelations = relations(membershipRequests, ({ one }) => ({
  account: one(accounts, {
    fields: [membershipRequests.memberId],
    references: [accounts.id],
  }),
  item: one(itemsRaw, {
    fields: [membershipRequests.itemId],
    references: [itemsRaw.id],
  }),
}));

export const itemLoginSchemaRelations = relations(itemLoginSchemas, ({ one, many }) => ({
  accounts: many(accounts),
  item: one(itemsRaw, {
    fields: [itemLoginSchemas.itemPath],
    references: [itemsRaw.path],
  }),
}));

export const guestPasswordRelations = relations(guestPasswords, ({ one }) => ({
  account: one(accounts, {
    fields: [guestPasswords.guestId],
    references: [accounts.id],
  }),
}));

export const itemVisibilitiesRelations = relations(itemVisibilities, ({ one }) => ({
  account: one(accounts, {
    fields: [itemVisibilities.creatorId],
    references: [accounts.id],
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
