import type { ItemRaw } from '../services/item/item';
import type { MinimalGuest, MinimalMember } from '../types';
import {
  accountsTable,
  actionRequestExportsTable,
  actionsTable,
  appActionsTable,
  appDataTable,
  appSettingsTable,
  appsTable,
  chatMentionsTable,
  chatMessagesTable,
  guestsView,
  invitationsTable,
  itemBookmarksTable,
  itemExportRequestsTable,
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
  memberProfilesTable,
  membersView,
  membershipRequestsTable,
  publishedItemsTable,
  shortLinksTable,
  tagsTable,
} from './schema';

export type AccountInsertDTO = typeof accountsTable.$inferInsert;
export type AccountRaw = typeof accountsTable.$inferSelect;
/**
 * Minimal account
 * This denotes an "identity" on the server
 * It should be enough for most operations
 */
export type MinimalAccount = {
  id: string;
  name: string;
};

// evaluate if it would be enough to specify "minimal account" on items and such
export type NullableAccount = MinimalAccount | null;

// HACK: Using inferSelect since this is a PGView and it does not allow to insert on the view
// HACK: Remove the too wide "type" from the select which allows a union and add over it the more specific single value type of individual
export type MemberCreationDTO = Omit<typeof membersView.$inferSelect, 'type'> & {
  email: string;
  type: 'individual';
};
export type MemberRaw = Omit<typeof membersView.$inferSelect, 'type'> & {
  type: 'individual';
  email: string;
  isValidated: boolean;
};

/**
 * Raw insert type used when creating an item
 */
export type ItemInsertDTO = typeof itemsRawTable.$inferInsert;

export type NullableItem = ItemRaw | null;

// note: cannot combine nicely Item and ItemWithCreator when defined with omit
// export type ItemWithCreator = Omit<Item, 'creatorId'> & { creator: MinimalAccount };
export type ItemWithCreator = ItemRaw & { creator: NullableAccount };

// item created by the server with necessary properties
export type MinimalItemForInsert = {
  id: ItemRaw['id'];
  name: ItemRaw['name'];
  type: ItemRaw['type'];
  path: ItemRaw['path'];
  extra: ItemRaw['extra'];
  settings: ItemRaw['settings'];
  order?: ItemRaw['order'];
};

export type ItemLoginSchemaRaw = typeof itemLoginSchemasTable.$inferSelect;
export type ItemLoginSchemaWithItem = ItemLoginSchemaRaw & { item: ItemRaw };
export type GuestInsertDTO = typeof accountsTable.$inferInsert;
export type GuestRaw = Omit<typeof guestsView.$inferSelect, 'type'> & {
  type: 'guest';
};
export type GuestWithItemLoginSchema = GuestRaw & {
  itemLoginSchema: ItemLoginSchemaRaw | null;
};

// --- ItemVisibilities
export type ItemVisibilityRaw = typeof itemVisibilitiesTable.$inferSelect;
export type ItemVisibilityWithItem = ItemVisibilityRaw & {
  item: ItemRaw;
};

// ---- Published items

export type ItemPublishedRaw = typeof publishedItemsTable.$inferSelect;

export type ItemPublishedWithItem = Omit<typeof publishedItemsTable.$inferSelect, 'itemPath'> & {
  item: ItemRaw;
};
export type ItemPublishedWithItemWithCreator = ItemPublishedRaw & {
  item: ItemWithCreator;
};

// --- Actions
export type ActionInsertDTO = typeof actionsTable.$inferInsert;
export type ActionRaw = typeof actionsTable.$inferSelect;
// this is type that matches the automatically linked entities from typeORM,
// we should check each usage location to see if including the realtions is necessary or not
export type ActionWithItem = typeof actionsTable.$inferSelect & {
  item: NullableItem;
};
export type ActionWithItemAndAccount = ActionWithItem & {
  account: NullableAccount;
};

// --- ChatMessage
export type ChatMessageInsertDTO = typeof chatMessagesTable.$inferInsert;
export type ChatMessageRaw = typeof chatMessagesTable.$inferSelect;
export type ChatMessageWithItem = ChatMessageRaw & { item: ItemRaw };
export type ChatMessageWithCreator = ChatMessageRaw & {
  creator: NullableAccount;
};
export type ChatMessageWithCreatorAndItem = ChatMessageWithCreator & {
  item: ItemRaw;
};

// --- ChatMentions
export type ChatMentionRaw = typeof chatMentionsTable.$inferSelect;
export type ChatMentionWithMessage = ChatMentionRaw & {
  message: ChatMessageRaw;
};
export type ChatMentionWithMessageAndCreator = ChatMentionRaw & {
  account: MinimalAccount;
  message: ChatMessageRaw;
};
export type ChatMentionWithMessageWithoutCreator = Omit<ChatMentionRaw, 'message'> & {
  message: Omit<ChatMessageRaw, 'creatorId'>;
};

// --- Invitations
export type InvitationInsertDTO = typeof invitationsTable.$inferInsert;
export type InvitationRaw = typeof invitationsTable.$inferSelect;
export type InvitationWithItem = InvitationRaw & {
  item: ItemRaw;
};
export type InvitationWithItemAndCreator = Omit<InvitationWithItem, 'creatorId'> & {
  creator: NullableAccount;
};

// --- Tags
export type TagRaw = typeof tagsTable.$inferSelect;
export type TagCreationDTO = typeof tagsTable.$inferInsert;

// --- ItemTags
export type ItemTagInsertDTO = typeof itemTagsTable.$inferInsert;
export type ItemTagRaw = typeof itemTagsTable.$inferSelect;

// --- ItemMembership
export type ItemMembershipRaw = typeof itemMembershipsTable.$inferSelect;
export type ItemMembershipInsertDTO = typeof itemMembershipsTable.$inferInsert;
export type ItemMembershipWithItem = ItemMembershipRaw & {
  item: ItemRaw;
};
export type ItemMembershipWithItemAndAccount = ItemMembershipWithItem & {
  // special type for get memberships - needs email
  account: AccountRaw;
};
export type ItemMembershipWithItemAndCompleteAccount = ItemMembershipWithItem & {
  // special type for get memberships - needs email
  account: MinimalGuest | (MinimalMember & { email: string });
};
export type ItemMembershipWithItemAndAccountAndCreator = Omit<
  ItemMembershipWithItem,
  'accountId'
> & {
  account: AccountRaw;
  creator: AccountRaw;
};

// -- App
export type AppRaw = typeof appsTable.$inferSelect;

// --- AppAction
export type AppActionRaw = typeof appActionsTable.$inferSelect;
export type AppActionWithItem = AppActionRaw & {
  item: ItemRaw;
};
export type AppActionWithItemAndAccount = AppActionRaw & {
  item: ItemRaw;
  account: MinimalAccount;
};

// --- AppSetting
export type AppSettingInsertDTO = typeof appSettingsTable.$inferInsert;
export type AppSettingRaw = typeof appSettingsTable.$inferSelect;
export type AppSettingWithItem = AppSettingRaw & { item: ItemRaw };

// --- AppData
export type AppDataInsertDTO = typeof appDataTable.$inferInsert;
export type AppDataRaw = typeof appDataTable.$inferSelect;
export type AppDataWithItem = AppDataRaw & {
  item: ItemRaw;
};
export type AppDataWithItemAndAccountAndCreator = AppDataRaw & {
  item: ItemRaw;
  account: MinimalAccount;
  creator: MinimalAccount | null;
};

// --- ShortLink
export type ShortLinkRaw = typeof shortLinksTable.$inferSelect;
export type ShortLinkInsertDTO = typeof shortLinksTable.$inferInsert;
export type ShortLinkWithItem = ShortLinkRaw & { item: ItemRaw };

// --- ItemLike
export type ItemLikeRaw = typeof itemLikesTable.$inferSelect;
export type ItemLikeWithItem = ItemLikeRaw & { item: ItemRaw };
export type ItemLikeWithItemWithCreator = ItemLikeRaw & { item: ItemWithCreator };
export type ItemLikeWithItemAndAccount = ItemLikeWithItem & {
  creator: MinimalAccount;
};

// --- ItemGeolocation
export type ItemGeolocationRaw = typeof itemGeolocationsTable.$inferSelect;
export type ItemGeolocationInsertDTO = typeof itemGeolocationsTable.$inferInsert;
export type ItemGeolocationWithItem = ItemGeolocationRaw & { item: ItemRaw };
export type ItemGeolocationWithItemWithCreator = ItemGeolocationRaw & {
  item: ItemWithCreator;
};

// --- ItemValidation
export type ItemValidationRaw = typeof itemValidationsTable.$inferSelect;
export type ItemValidationWithItem = ItemValidationRaw & { item: ItemRaw };
export type ItemValidationInsertDTO = typeof itemValidationsTable.$inferInsert;

// --- ItemValidationGroup
export type ItemValidationGroupRaw = typeof itemValidationGroupsTable.$inferSelect;
export type ItemValidationGroupWithItemAndValidations = ItemValidationGroupRaw & {
  item: ItemRaw;
  itemValidations: ItemValidationRaw[];
};
export type ItemValidationGroupWithItemAndValidationsWithItem = ItemValidationGroupRaw & {
  item: ItemRaw;
  itemValidations: ItemValidationWithItem[];
};
export type ItemValidationGroupInsertDTO = typeof itemValidationGroupsTable.$inferInsert;

// --- ItemValidationReview
export type ItemValidationReviewRaw = typeof itemValidationReviewsTable.$inferSelect;
export type ItemValidationReviewInsertDTO = typeof itemValidationReviewsTable.$inferInsert;

// --- ItemBookmark
export type ItemBookmarkRaw = typeof itemBookmarksTable.$inferSelect;
export type ItemBookmarkRawWithItem = ItemBookmarkRaw & { item: ItemRaw };
export type ItemBookmarkRawWithItemWithCreator = ItemBookmarkRaw & { item: ItemWithCreator };
export type ItemBookmarkInsertDTO = typeof itemBookmarksTable.$inferInsert;
export type ItemBookmarkRawWithItemAndAccount = ItemBookmarkRaw & {
  item: ItemRaw;
  account: MinimalAccount;
};

// --- MemberProfile
export type MemberProfileRaw = typeof memberProfilesTable.$inferSelect;
export type MemberProfileInsertDTO = typeof memberProfilesTable.$inferInsert;

export type ActionRequestExportRaw = typeof actionRequestExportsTable.$inferSelect;
export type ActionRequestExportFormat = ActionRequestExportRaw['format'];

export type ItemExportRequestRaw = typeof itemExportRequestsTable.$inferSelect;

export type MembershipRequestRaw = typeof membershipRequestsTable.$inferSelect;
export type MembershipRequestWithMember = MembershipRequestRaw & { member: MemberRaw };
