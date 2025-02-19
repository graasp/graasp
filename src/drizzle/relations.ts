import { relations } from 'drizzle-orm/relations';

import {
  account,
  action,
  actionRequestExport,
  app,
  appAction,
  appData,
  appSetting,
  category,
  chatMention,
  chatMessage,
  guestPassword,
  invitation,
  item,
  itemCategory,
  itemFavorite,
  itemFlag,
  itemGeolocation,
  itemLike,
  itemLoginSchema,
  itemMembership,
  itemPublished,
  itemTag,
  itemValidation,
  itemValidationGroup,
  itemValidationReview,
  itemVisibility,
  memberPassword,
  memberProfile,
  membershipRequest,
  publisher,
  recycledItemData,
  shortLink,
  tag,
} from './schema';

export const itemPublishedRelations = relations(itemPublished, ({ one }) => ({
  account: one(account, {
    fields: [itemPublished.creatorId],
    references: [account.id],
  }),
  item: one(item, {
    fields: [itemPublished.itemPath],
    references: [item.path],
  }),
}));

export const accountRelations = relations(account, ({ one, many }) => ({
  itemPublisheds: many(itemPublished),
  itemMemberships_creatorId: many(itemMembership, {
    relationName: 'itemMembership_creatorId_account_id',
  }),
  itemMemberships_accountId: many(itemMembership, {
    relationName: 'itemMembership_accountId_account_id',
  }),
  memberPasswords: many(memberPassword),
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
  memberProfiles: many(memberProfile),
  actions: many(action),
  actionRequestExports: many(actionRequestExport),
  items: many(item),
  membershipRequests: many(membershipRequest),
  itemLoginSchema: one(itemLoginSchema, {
    fields: [account.itemLoginSchemaId],
    references: [itemLoginSchema.id],
  }),
  guestPasswords: many(guestPassword),
  itemVisibilities: many(itemVisibility),
}));

export const itemRelations = relations(item, ({ one, many }) => ({
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
  account: one(account, {
    fields: [item.creatorId],
    references: [account.id],
  }),
  membershipRequests: many(membershipRequest),
  itemLoginSchemas: many(itemLoginSchema),
  itemVisibilities: many(itemVisibility),
  itemTags: many(itemTag),
}));

export const itemMembershipRelations = relations(itemMembership, ({ one }) => ({
  account_creatorId: one(account, {
    fields: [itemMembership.creatorId],
    references: [account.id],
    relationName: 'itemMembership_creatorId_account_id',
  }),
  item: one(item, {
    fields: [itemMembership.itemPath],
    references: [item.path],
  }),
  account_accountId: one(account, {
    fields: [itemMembership.accountId],
    references: [account.id],
    relationName: 'itemMembership_accountId_account_id',
  }),
}));

export const memberPasswordRelations = relations(memberPassword, ({ one }) => ({
  account: one(account, {
    fields: [memberPassword.memberId],
    references: [account.id],
  }),
}));

export const recycledItemDataRelations = relations(recycledItemData, ({ one }) => ({
  account: one(account, {
    fields: [recycledItemData.creatorId],
    references: [account.id],
  }),
  item: one(item, {
    fields: [recycledItemData.itemPath],
    references: [item.path],
  }),
}));

export const itemLikeRelations = relations(itemLike, ({ one }) => ({
  account: one(account, {
    fields: [itemLike.creatorId],
    references: [account.id],
  }),
  item: one(item, {
    fields: [itemLike.itemId],
    references: [item.id],
  }),
}));

export const itemFlagRelations = relations(itemFlag, ({ one }) => ({
  item: one(item, {
    fields: [itemFlag.itemId],
    references: [item.id],
  }),
  account: one(account, {
    fields: [itemFlag.creatorId],
    references: [account.id],
  }),
}));

export const itemCategoryRelations = relations(itemCategory, ({ one }) => ({
  category: one(category, {
    fields: [itemCategory.categoryId],
    references: [category.id],
  }),
  account: one(account, {
    fields: [itemCategory.creatorId],
    references: [account.id],
  }),
  item: one(item, {
    fields: [itemCategory.itemPath],
    references: [item.path],
  }),
}));

export const categoryRelations = relations(category, ({ many }) => ({
  itemCategories: many(itemCategory),
}));

export const chatMessageRelations = relations(chatMessage, ({ one, many }) => ({
  item: one(item, {
    fields: [chatMessage.itemId],
    references: [item.id],
  }),
  account: one(account, {
    fields: [chatMessage.creatorId],
    references: [account.id],
  }),
  chatMentions: many(chatMention),
}));

export const chatMentionRelations = relations(chatMention, ({ one }) => ({
  chatMessage: one(chatMessage, {
    fields: [chatMention.messageId],
    references: [chatMessage.id],
  }),
  account: one(account, {
    fields: [chatMention.accountId],
    references: [account.id],
  }),
}));

export const appDataRelations = relations(appData, ({ one }) => ({
  item: one(item, {
    fields: [appData.itemId],
    references: [item.id],
  }),
  account_creatorId: one(account, {
    fields: [appData.creatorId],
    references: [account.id],
    relationName: 'appData_creatorId_account_id',
  }),
  account_accountId: one(account, {
    fields: [appData.accountId],
    references: [account.id],
    relationName: 'appData_accountId_account_id',
  }),
}));

export const appActionRelations = relations(appAction, ({ one }) => ({
  item: one(item, {
    fields: [appAction.itemId],
    references: [item.id],
  }),
  account: one(account, {
    fields: [appAction.accountId],
    references: [account.id],
  }),
}));

export const appSettingRelations = relations(appSetting, ({ one }) => ({
  item: one(item, {
    fields: [appSetting.itemId],
    references: [item.id],
  }),
  account: one(account, {
    fields: [appSetting.creatorId],
    references: [account.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  account: one(account, {
    fields: [invitation.creatorId],
    references: [account.id],
  }),
  item: one(item, {
    fields: [invitation.itemPath],
    references: [item.path],
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
  item: one(item, {
    fields: [itemValidationGroup.itemId],
    references: [item.id],
  }),
  itemValidations: many(itemValidation),
}));

export const itemValidationRelations = relations(itemValidation, ({ one, many }) => ({
  item: one(item, {
    fields: [itemValidation.itemId],
    references: [item.id],
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
  account: one(account, {
    fields: [itemValidationReview.reviewerId],
    references: [account.id],
  }),
}));

export const itemFavoriteRelations = relations(itemFavorite, ({ one }) => ({
  account: one(account, {
    fields: [itemFavorite.memberId],
    references: [account.id],
  }),
  item: one(item, {
    fields: [itemFavorite.itemId],
    references: [item.id],
  }),
}));

export const memberProfileRelations = relations(memberProfile, ({ one }) => ({
  account: one(account, {
    fields: [memberProfile.memberId],
    references: [account.id],
  }),
}));

export const shortLinkRelations = relations(shortLink, ({ one }) => ({
  item: one(item, {
    fields: [shortLink.itemId],
    references: [item.id],
  }),
}));

export const actionRelations = relations(action, ({ one }) => ({
  item: one(item, {
    fields: [action.itemId],
    references: [item.id],
  }),
  account: one(account, {
    fields: [action.accountId],
    references: [account.id],
  }),
}));

export const itemGeolocationRelations = relations(itemGeolocation, ({ one }) => ({
  item: one(item, {
    fields: [itemGeolocation.itemPath],
    references: [item.path],
  }),
}));

export const actionRequestExportRelations = relations(actionRequestExport, ({ one }) => ({
  item: one(item, {
    fields: [actionRequestExport.itemPath],
    references: [item.path],
  }),
  account: one(account, {
    fields: [actionRequestExport.memberId],
    references: [account.id],
  }),
}));

export const membershipRequestRelations = relations(membershipRequest, ({ one }) => ({
  account: one(account, {
    fields: [membershipRequest.memberId],
    references: [account.id],
  }),
  item: one(item, {
    fields: [membershipRequest.itemId],
    references: [item.id],
  }),
}));

export const itemLoginSchemaRelations = relations(itemLoginSchema, ({ one, many }) => ({
  accounts: many(account),
  item: one(item, {
    fields: [itemLoginSchema.itemPath],
    references: [item.path],
  }),
}));

export const guestPasswordRelations = relations(guestPassword, ({ one }) => ({
  account: one(account, {
    fields: [guestPassword.guestId],
    references: [account.id],
  }),
}));

export const itemVisibilityRelations = relations(itemVisibility, ({ one }) => ({
  account: one(account, {
    fields: [itemVisibility.creatorId],
    references: [account.id],
  }),
  item: one(item, {
    fields: [itemVisibility.itemPath],
    references: [item.path],
  }),
}));

export const itemTagRelations = relations(itemTag, ({ one }) => ({
  tag: one(tag, {
    fields: [itemTag.tagId],
    references: [tag.id],
  }),
  item: one(item, {
    fields: [itemTag.itemId],
    references: [item.id],
  }),
}));

export const tagRelations = relations(tag, ({ many }) => ({
  itemTags: many(itemTag),
}));
