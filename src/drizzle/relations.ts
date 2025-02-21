import { relations } from 'drizzle-orm/relations';

import {
  accounts,
  action,
  actionRequestExport,
  app,
  appAction,
  appData,
  appSetting,
  category,
  chatMention,
  chatMessage,
  guestPasswords,
  invitation,
  itemCategory,
  itemFavorite,
  itemFlag,
  itemGeolocation,
  itemLike,
  itemLoginSchema,
  itemMembership,
  itemPublished,
  itemRaw,
  itemTag,
  itemValidation,
  itemValidationGroup,
  itemValidationReview,
  itemVisibility,
  memberPasswords,
  memberProfiles,
  membershipRequest,
  publisher,
  recycledItemData,
  shortLink,
  tag,
} from './schema';

export const itemPublishedRelations = relations(itemPublished, ({ one }) => ({
  account: one(accounts, {
    fields: [itemPublished.creatorId],
    references: [accounts.id],
  }),
  item: one(itemRaw, {
    fields: [itemPublished.itemPath],
    references: [itemRaw.path],
  }),
}));

export const accountRelations = relations(accounts, ({ one, many }) => ({
  itemPublisheds: many(itemPublished),
  itemMemberships_creatorId: many(itemMembership, {
    relationName: 'itemMembership_creatorId_account_id',
  }),
  itemMemberships_accountId: many(itemMembership, {
    relationName: 'itemMembership_accountId_account_id',
  }),
  memberPasswords: many(memberPasswords),
  recycledItemData: many(recycledItemData),
  itemLikes: many(itemLike),
  itemFlags: many(itemFlag),
  itemCategories: many(itemCategory),
  chatMessages: many(chatMessage),
  chatMentions: many(chatMention),
  appData_creatorId: many(appData, {
    relationName: 'appData_creatorId_account_id',
  }),
  appData_accountId: many(appData, {
    relationName: 'appData_accountId_account_id',
  }),
  appActions: many(appAction),
  appSettings: many(appSetting),
  invitations: many(invitation),
  itemValidationReviews: many(itemValidationReview),
  itemFavorites: many(itemFavorite),
  memberProfiles: many(memberProfiles),
  actions: many(action),
  actionRequestExports: many(actionRequestExport),
  items: many(itemRaw),
  membershipRequests: many(membershipRequest),
  itemLoginSchema: one(itemLoginSchema, {
    fields: [accounts.itemLoginSchemaId],
    references: [itemLoginSchema.id],
  }),
  guestPasswords: many(guestPasswords),
  itemVisibilities: many(itemVisibility),
}));

export const itemRelations = relations(itemRaw, ({ one, many }) => ({
  itemPublisheds: many(itemPublished),
  itemMemberships: many(itemMembership),
  recycledItemData: many(recycledItemData),
  itemLikes: many(itemLike),
  itemFlags: many(itemFlag),
  itemCategories: many(itemCategory),
  chatMessages: many(chatMessage),
  appData: many(appData),
  appActions: many(appAction),
  appSettings: many(appSetting),
  invitations: many(invitation),
  itemValidationGroups: many(itemValidationGroup),
  itemValidations: many(itemValidation),
  itemFavorites: many(itemFavorite),
  shortLinks: many(shortLink),
  actions: many(action),
  itemGeolocations: many(itemGeolocation),
  actionRequestExports: many(actionRequestExport),
  account: one(accounts, {
    fields: [itemRaw.creatorId],
    references: [accounts.id],
  }),
  membershipRequests: many(membershipRequest),
  itemLoginSchemas: many(itemLoginSchema),
  itemVisibilities: many(itemVisibility),
  itemTags: many(itemTag),
}));

export const itemMembershipRelations = relations(itemMembership, ({ one }) => ({
  creator: one(accounts, {
    fields: [itemMembership.creatorId],
    references: [accounts.id],
    relationName: 'itemMembership_creatorId_account_id',
  }),
  item: one(itemRaw, {
    fields: [itemMembership.itemPath],
    references: [itemRaw.path],
  }),
  account: one(accounts, {
    fields: [itemMembership.accountId],
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

export const recycledItemDataRelations = relations(recycledItemData, ({ one }) => ({
  account: one(accounts, {
    fields: [recycledItemData.creatorId],
    references: [accounts.id],
  }),
  item: one(itemRaw, {
    fields: [recycledItemData.itemPath],
    references: [itemRaw.path],
  }),
}));

export const itemLikeRelations = relations(itemLike, ({ one }) => ({
  account: one(accounts, {
    fields: [itemLike.creatorId],
    references: [accounts.id],
  }),
  item: one(itemRaw, {
    fields: [itemLike.itemId],
    references: [itemRaw.id],
  }),
}));

export const itemFlagRelations = relations(itemFlag, ({ one }) => ({
  item: one(itemRaw, {
    fields: [itemFlag.itemId],
    references: [itemRaw.id],
  }),
  account: one(accounts, {
    fields: [itemFlag.creatorId],
    references: [accounts.id],
  }),
}));

export const itemCategoryRelations = relations(itemCategory, ({ one }) => ({
  category: one(category, {
    fields: [itemCategory.categoryId],
    references: [category.id],
  }),
  account: one(accounts, {
    fields: [itemCategory.creatorId],
    references: [accounts.id],
  }),
  item: one(itemRaw, {
    fields: [itemCategory.itemPath],
    references: [itemRaw.path],
  }),
}));

export const categoryRelations = relations(category, ({ many }) => ({
  itemCategories: many(itemCategory),
}));

export const chatMessageRelations = relations(chatMessage, ({ one, many }) => ({
  item: one(itemRaw, {
    fields: [chatMessage.itemId],
    references: [itemRaw.id],
  }),
  account: one(accounts, {
    fields: [chatMessage.creatorId],
    references: [accounts.id],
  }),
  chatMentions: many(chatMention),
}));

export const chatMentionRelations = relations(chatMention, ({ one }) => ({
  chatMessage: one(chatMessage, {
    fields: [chatMention.messageId],
    references: [chatMessage.id],
  }),
  account: one(accounts, {
    fields: [chatMention.accountId],
    references: [accounts.id],
  }),
}));

export const appDataRelations = relations(appData, ({ one }) => ({
  item: one(itemRaw, {
    fields: [appData.itemId],
    references: [itemRaw.id],
  }),
  account_creatorId: one(accounts, {
    fields: [appData.creatorId],
    references: [accounts.id],
    relationName: 'appData_creatorId_account_id',
  }),
  account_accountId: one(accounts, {
    fields: [appData.accountId],
    references: [accounts.id],
    relationName: 'appData_accountId_account_id',
  }),
}));

export const appActionRelations = relations(appAction, ({ one }) => ({
  item: one(itemRaw, {
    fields: [appAction.itemId],
    references: [itemRaw.id],
  }),
  account: one(accounts, {
    fields: [appAction.accountId],
    references: [accounts.id],
  }),
}));

export const appSettingRelations = relations(appSetting, ({ one }) => ({
  item: one(itemRaw, {
    fields: [appSetting.itemId],
    references: [itemRaw.id],
  }),
  account: one(accounts, {
    fields: [appSetting.creatorId],
    references: [accounts.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  account: one(accounts, {
    fields: [invitation.creatorId],
    references: [accounts.id],
  }),
  item: one(itemRaw, {
    fields: [invitation.itemPath],
    references: [itemRaw.path],
  }),
}));

export const appRelations = relations(app, ({ one }) => ({
  publisher: one(publisher, {
    fields: [app.publisherId],
    references: [publisher.id],
  }),
}));

export const publisherRelations = relations(publisher, ({ many }) => ({
  apps: many(app),
}));

export const itemValidationGroupRelations = relations(itemValidationGroup, ({ one, many }) => ({
  item: one(itemRaw, {
    fields: [itemValidationGroup.itemId],
    references: [itemRaw.id],
  }),
  itemValidations: many(itemValidation),
}));

export const itemValidationRelations = relations(itemValidation, ({ one, many }) => ({
  item: one(itemRaw, {
    fields: [itemValidation.itemId],
    references: [itemRaw.id],
  }),
  itemValidationGroup: one(itemValidationGroup, {
    fields: [itemValidation.itemValidationGroupId],
    references: [itemValidationGroup.id],
  }),
  itemValidationReviews: many(itemValidationReview),
}));

export const itemValidationReviewRelations = relations(itemValidationReview, ({ one }) => ({
  itemValidation: one(itemValidation, {
    fields: [itemValidationReview.itemValidationId],
    references: [itemValidation.id],
  }),
  account: one(accounts, {
    fields: [itemValidationReview.reviewerId],
    references: [accounts.id],
  }),
}));

export const itemFavoriteRelations = relations(itemFavorite, ({ one }) => ({
  account: one(accounts, {
    fields: [itemFavorite.memberId],
    references: [accounts.id],
  }),
  item: one(itemRaw, {
    fields: [itemFavorite.itemId],
    references: [itemRaw.id],
  }),
}));

export const memberProfileRelations = relations(memberProfiles, ({ one }) => ({
  member: one(accounts, {
    fields: [memberProfiles.memberId],
    references: [accounts.id],
  }),
}));

export const shortLinkRelations = relations(shortLink, ({ one }) => ({
  item: one(itemRaw, {
    fields: [shortLink.itemId],
    references: [itemRaw.id],
  }),
}));

export const actionRelations = relations(action, ({ one }) => ({
  item: one(itemRaw, {
    fields: [action.itemId],
    references: [itemRaw.id],
  }),
  account: one(accounts, {
    fields: [action.accountId],
    references: [accounts.id],
  }),
}));

export const itemGeolocationRelations = relations(itemGeolocation, ({ one }) => ({
  item: one(itemRaw, {
    fields: [itemGeolocation.itemPath],
    references: [itemRaw.path],
  }),
}));

export const actionRequestExportRelations = relations(actionRequestExport, ({ one }) => ({
  item: one(itemRaw, {
    fields: [actionRequestExport.itemPath],
    references: [itemRaw.path],
  }),
  account: one(accounts, {
    fields: [actionRequestExport.memberId],
    references: [accounts.id],
  }),
}));

export const membershipRequestRelations = relations(membershipRequest, ({ one }) => ({
  account: one(accounts, {
    fields: [membershipRequest.memberId],
    references: [accounts.id],
  }),
  item: one(itemRaw, {
    fields: [membershipRequest.itemId],
    references: [itemRaw.id],
  }),
}));

export const itemLoginSchemaRelations = relations(itemLoginSchema, ({ one, many }) => ({
  accounts: many(accounts),
  item: one(itemRaw, {
    fields: [itemLoginSchema.itemPath],
    references: [itemRaw.path],
  }),
}));

export const guestPasswordRelations = relations(guestPasswords, ({ one }) => ({
  account: one(accounts, {
    fields: [guestPasswords.guestId],
    references: [accounts.id],
  }),
}));

export const itemVisibilityRelations = relations(itemVisibility, ({ one }) => ({
  account: one(accounts, {
    fields: [itemVisibility.creatorId],
    references: [accounts.id],
  }),
  item: one(itemRaw, {
    fields: [itemVisibility.itemPath],
    references: [itemRaw.path],
  }),
}));

export const itemTagRelations = relations(itemTag, ({ one }) => ({
  tag: one(tag, {
    fields: [itemTag.tagId],
    references: [tag.id],
  }),
  item: one(itemRaw, {
    fields: [itemTag.itemId],
    references: [itemRaw.id],
  }),
}));

export const tagRelations = relations(tag, ({ many }) => ({
  itemTags: many(itemTag),
}));
