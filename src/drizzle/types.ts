import type {
  AppItemExtra,
  DocumentItemExtra,
  EtherpadItemExtra,
  FolderItemExtra,
  H5PItemExtra,
  ItemSettings,
  LinkItemExtra,
  LinkItemSettings,
  LocalFileItemExtra,
  S3FileItemExtra,
  ShortcutItemExtra,
  UnionOfConst,
} from '@graasp/sdk';

import type { MinimalGuest, MinimalMember } from '../types.js';
import {
  accountsTable,
  actionRequestExports,
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
  itemGeolocationsTable,
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
} from './schema.js';

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
// HACK: Remove the too wide "type" from the select which allows a union and add over it the more specific single value type of individual
export type MemberCreationDTO = Omit<typeof membersView.$inferSelect, 'type'> & {
  email: string;
  type: 'individual';
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

export type ItemSettingsMap = {
  [ItemType.APP]: ItemSettings;
  [ItemType.DOCUMENT]: ItemSettings;
  [ItemType.ETHERPAD]: ItemSettings;
  [ItemType.FOLDER]: ItemSettings;
  [ItemType.H5P]: ItemSettings;
  [ItemType.LINK]: LinkItemSettings;
  [ItemType.LOCAL_FILE]: ItemSettings;
  [ItemType.S3_FILE]: ItemSettings;
  [ItemType.SHORTCUT]: ItemSettings;
};

// local type alias to simplify the notation
export type ItemTypeEnumKeys = keyof ItemExtraMap;

export type ItemWithType<T extends ItemTypeEnumKeys> = Item & {
  extra: ItemExtraMap[T];
  settings: ItemSettingsMap[T];
};
// note: cannot combine nicely Item and ItemWithCreator when defined with omit
// export type ItemWithCreator = Omit<Item, 'creatorId'> & { creator: Account };
export type ItemWithCreator = ItemRaw & { creator: MemberRaw | null };

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
export type ChatMessageWithCreator = ChatMessageRaw & {
  creator: NullableAccount;
};
export type ChatMessageWithCreatorAndItem = ChatMessageWithCreator & {
  item: Item;
};

// --- ChatMentions
export type ChatMentionRaw = typeof chatMentionsTable.$inferSelect;
export type ChatMentionWithMessage = ChatMentionRaw & {
  message: ChatMessageRaw;
};
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
export type InvitationWithItemAndCreator = Omit<InvitationWithItem, 'creatorId'> & {
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
export type ItemMembershipInsertDTO = typeof itemMemberships.$inferInsert;
export type ItemMembershipWithItem = ItemMembershipRaw & {
  item: ItemRaw;
};
export type ItemMembershipWithItemAndAccount = ItemMembershipWithItem & {
  // TODO: special type for get memberships - needs email
  account: AccountRaw;
};
export type ItemMembershipWithItemAndCompleteAccount = ItemMembershipWithItem & {
  // TODO: special type for get memberships - needs email
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
export type ItemLikeWithItemAndAccount = ItemLikeWithItem & {
  creator: Account;
};

// --- ItemGeolocation
export type ItemGeolocationRaw = typeof itemGeolocationsTable.$inferSelect;
export type ItemGeolocationInsertDTO = typeof itemGeolocationsTable.$inferInsert;
export type ItemGeolocationWithItem = ItemGeolocationRaw & { item: Item };
export type ItemGeolocationWithItemWithCreator = ItemGeolocationRaw & {
  item: ItemWithCreator;
};

// --- ItemValidation
export type ItemValidationRaw = typeof itemValidations.$inferSelect;
export type ItemValidationWithItem = ItemValidationRaw & { item: Item };
export type ItemValidationInsertDTO = typeof itemValidations.$inferInsert;

// --- ItemValidationGroup
export type ItemValidationGroupRaw = typeof itemValidationGroups.$inferSelect;
export type ItemValidationGroupWithItemAndValidations = ItemValidationGroupRaw & {
  item: Item;
  itemValidations: ItemValidationRaw[];
};
export type ItemValidationGroupWithItemAndValidationsWithItem = ItemValidationGroupRaw & {
  item: Item;
  itemValidations: ItemValidationWithItem[];
};
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
export type MemberProfileInsertDTO = typeof memberProfiles.$inferInsert;

export type ActionRequestExportRaw = typeof actionRequestExports.$inferSelect;
