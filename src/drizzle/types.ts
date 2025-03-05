import {
  AppItemExtra,
  DocumentItemExtra,
  EtherpadItemExtra,
  FolderItemExtra,
  H5PItemExtra,
  LinkItemExtra,
  LocalFileItemExtra,
  S3FileItemExtra,
  ShortcutItemExtra,
  UnionOfConst,
} from '@graasp/sdk';

import {
  accountsTable,
  actionsTable,
  appActions,
  appDatas,
  appSettings,
  apps,
  chatMentionsTable,
  chatMessagesTable,
  guestsView,
  invitationsTable,
  itemBookmarks,
  itemGeolocations,
  itemLikes,
  itemLoginSchemas,
  itemMemberships,
  itemTags,
  itemValidationGroups,
  itemValidationReviews,
  itemValidations,
  itemVisibilities,
  items,
  itemsRaw,
  memberProfiles,
  membersView,
  publishedItems,
  shortLinks,
  tags,
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
export type Account = MinimalAccount;
export type NullableAccount = Account | null;

// HACK: Using inferSelect since this is a PGView and it does not allow to insert on the view
export type MemberCreationDTO = typeof membersView.$inferSelect & {
  email: string;
};
export type MemberRaw = Omit<typeof membersView.$inferSelect, 'type'> & {
  type: 'individual';
  email: string;
};

export type ItemLoginSchemaRaw = typeof itemLoginSchemas.$inferSelect;
export type ItemLoginSchemaWithItem = ItemLoginSchemaRaw & { item: Item };
export type GuestInsertDTO = typeof accountsTable.$inferInsert;
export type GuestRaw = Omit<typeof guestsView.$inferSelect, 'type'> & {
  type: 'guest';
};
export type GuestWithItemLoginSchema = GuestRaw & {
  itemLoginSchema: ItemLoginSchemaRaw | null;
};

/**
 * Raw insert type used when creating an item
 */
export type ItemInsertDTO = typeof itemsRaw.$inferInsert;

/**
 * Raw return type given when retrieveing from the db.
 */
export type ItemRaw = typeof items.$inferSelect;

/**
 * Utility type for consumers. This should be prefered over the raw return type
 */
export type Item = Omit<ItemRaw, 'order'>;
export type NullableItem = Item | null;

/**
 * Item types
 */
export const ItemType = {
  APP: 'app',
  DOCUMENT: 'document',
  FOLDER: 'folder',
  LINK: 'embeddedLink',
  LOCAL_FILE: 'file',
  S3_FILE: 's3File',
  SHORTCUT: 'shortcut',
  H5P: 'h5p',
  ETHERPAD: 'etherpad',
} as const;
export type ItemTypeUnion = UnionOfConst<typeof ItemType>;

export type ItemExtraMap = {
  [ItemType.APP]: AppItemExtra;
  [ItemType.DOCUMENT]: DocumentItemExtra;
  [ItemType.ETHERPAD]: EtherpadItemExtra;
  [ItemType.FOLDER]: FolderItemExtra;
  [ItemType.H5P]: H5PItemExtra;
  [ItemType.LINK]: LinkItemExtra;
  [ItemType.LOCAL_FILE]: LocalFileItemExtra;
  [ItemType.S3_FILE]: S3FileItemExtra;
  [ItemType.SHORTCUT]: ShortcutItemExtra;
};

// local type alias to simplify the notation
export type ItemTypeEnumKeys = keyof ItemExtraMap;

export type ItemWithType<TExtra extends ItemTypeEnumKeys> = Item & {
  extra: ItemExtraMap[TExtra];
};
// note: cannot combine nicely Item and ItemWithCreator when defined with omit
// export type ItemWithCreator = Omit<Item, 'creatorId'> & { creator: Account };
export type ItemWithCreator = ItemRaw & { creator: Account | null };

// --- ItemVisibilities
export type ItemVisibilityRaw = typeof itemVisibilities.$inferSelect;
export type ItemVisibilityWithItem = Omit<typeof itemVisibilities.$inferSelect, 'itemPath'> & {
  item: Item;
};

// ---- Published items

export type ItemPublishedRaw = typeof publishedItems.$inferSelect;

export type ItemPublishedWithItem = Omit<typeof publishedItems.$inferSelect, 'itemPath'> & {
  item: Item;
};
export type ItemPublishedWithItemWithCreator = ItemPublishedRaw & {
  item: ItemWithCreator;
};

// --- Actions
export type ActionInsertDTO = typeof actionsTable.$inferInsert;
export type ActionRaw = typeof actionsTable.$inferSelect;
// this is type that matches the automatically linked entities from typeORM,
// we should check each usage location to see if including the realtions is necessary or not
export type ActionWithItem = Omit<typeof actionsTable.$inferSelect, 'accountId' | 'itemId'> & {
  item: NullableItem;
};
export type ActionWithItemAndAccount = ActionWithItem & {
  account: NullableAccount;
};

// --- ChatMessage
export type ChatMessageInsertDTO = typeof chatMessagesTable.$inferInsert;
export type ChatMessageRaw = typeof chatMessagesTable.$inferSelect;
export type ChatMessageWithItem = ChatMessageRaw & { item: Item };
export type ChatMessageWithCreator = Omit<ChatMessageRaw, 'creatorId'> & {
  creator: NullableAccount;
};
export type ChatMessageWithCreatorAndItem = Omit<ChatMessageWithCreator, 'itemId'> & {
  item: Item;
};

// --- ChatMentions
export type ChatMentionRaw = typeof chatMentionsTable.$inferSelect;
export type ChatMentionWithMessageAndCreator = Omit<ChatMentionRaw, 'accountId' | 'messageId'> & {
  account: MinimalAccount;
  message: ChatMessageRaw;
};

// --- Invitations
export type InvitationInsertDTO = typeof invitationsTable.$inferInsert;
export type InvitationRaw = typeof invitationsTable.$inferSelect;
export type InvitationWithItem = InvitationRaw & {
  item: Item;
};
export type InvitationWIthItemAndCreator = Omit<InvitationWithItem, 'creatorId'> & {
  creator: NullableAccount;
};

// --- Tags
export type TagRaw = typeof tags.$inferSelect;
export type TagCreationDTO = typeof tags.$inferInsert;

// --- ItemTags
export type ItemTagInsertDTO = typeof itemTags.$inferInsert;
export type ItemTagRaw = typeof itemTags.$inferSelect;

// --- ItemMembership
export type ItemMembershipRaw = typeof itemMemberships.$inferSelect;
export type ItemMembershipWithItem = Omit<ItemMembershipRaw, 'itemPath'> & {
  item: ItemRaw;
};
export type ItemMembershipWithItemAndAccount = Omit<ItemMembershipWithItem, 'accountId'> & {
  account: AccountRaw;
};
export type ItemMembershipWithItemAndAccountAndCreator = Omit<
  ItemMembershipWithItem,
  'accountId'
> & {
  account: AccountRaw;
  creator: AccountRaw;
};

// -- App
export type AppRaw = typeof apps.$inferSelect;

// --- AppAction
export type AppActionRaw = typeof appActions.$inferSelect;
export type AppActionWithItem = AppActionRaw & {
  item: Item;
};
export type AppActionWithItemAndAccount = AppActionRaw & {
  item: Item;
  account: MinimalAccount;
};

// --- AppSetting
export type AppSettingInsertDTO = typeof appSettings.$inferInsert;
export type AppSettingRaw = typeof appSettings.$inferSelect;
export type AppSettingWithItem = AppSettingRaw & { item: Item };

// --- AppData
export type AppDataInsertDTO = typeof appDatas.$inferInsert;
export type AppDataRaw = typeof appDatas.$inferSelect;
export type AppDataWithItem = AppDataRaw & {
  item: Item;
};
export type AppDataWithItemAndAccountAndCreator = AppDataRaw & {
  item: Item;
  account: Account;
  creator: Account | null;
};

// --- ShortLink
export type ShortLinkRaw = typeof shortLinks.$inferSelect;
export type ShortLinkInsertDTO = typeof shortLinks.$inferInsert;
export type ShortLinkWithItem = ShortLinkRaw & { item: Item };

// --- ItemLike
export type ItemLikeRaw = typeof itemLikes.$inferSelect;
export type ItemLikeWithItem = ItemLikeRaw & { item: Item };
export type ItemLikeWithItemAndAccount = ItemLikeWithItem & { creator: Account };

// --- ItemGeolocation
export type ItemGeolocationRaw = typeof itemGeolocations.$inferSelect;
export type ItemGeolocationWithItem = ItemGeolocationRaw & { item: Item };
export type ItemGeolocationWithItemAndCreator = ItemGeolocationRaw & {
  item: Item;
  creator: Account;
};

// --- ItemValidation
export type ItemValidationRaw = typeof itemValidations.$inferSelect;
export type ItemValidationInsertDTO = typeof itemValidations.$inferInsert;

// --- ItemValidationGroup
export type ItemValidationGroupRaw = typeof itemValidationGroups.$inferSelect;
export type ItemValidationGroupInsertDTO = typeof itemValidationGroups.$inferInsert;

// --- ItemValidationReview
export type ItemValidationReviewRaw = typeof itemValidationReviews.$inferSelect;
export type ItemValidationReviewInsertDTO = typeof itemValidationReviews.$inferInsert;

// --- Publisher
export type Publisher = any;

// --- ItemBookmark
export type ItemBookmarkRaw = typeof itemBookmarks.$inferSelect;
export type ItemBookmarkRawWithItem = ItemBookmarkRaw & { item: Item };
export type ItemBookmarkInsertDTO = typeof itemBookmarks.$inferInsert;
export type ItemBookmarkRawWithItemAndAccount = ItemBookmarkRaw & {
  item: Item;
  account: Account;
};

// --- MemberProfile
export type MemberProfileRaw = typeof memberProfiles.$inferSelect;
