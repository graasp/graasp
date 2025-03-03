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
  chatMentionsTable,
  chatMessagesTable,
  guestsView,
  invitationsTable,
  itemMemberships,
  itemTags,
  items,
  itemsRaw,
  membersView,
  publishedItems,
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
};
export type GuestRaw = Omit<typeof guestsView.$inferSelect, 'type'> & {
  type: 'guest';
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
export type ItemWithCreator = Omit<Item, 'creatorId'> & { creator: Account };

// ---- Published items

export type PublishedIteminsertDTO = typeof publishedItems.$inferInsert;
export type PublishedItemRaw = typeof publishedItems.$inferSelect;
export type ItemPublishedWithItem = Omit<
  typeof publishedItems.$inferSelect,
  'itemPath'
> & {
  item: Item;
};
export type ItemPublishedWithItemAndAccount = ItemPublishedWithItem & {
  creator: Account;
};

// --- Actions
export type ActionInsertDTO = typeof actionsTable.$inferInsert;
export type ActionRaw = typeof actionsTable.$inferSelect;
// this is type that matches the automatically linked entities from typeORM,
// we should check each usage location to see if including the realtions is necessary or not
export type ActionWithItem = Omit<
  typeof actionsTable.$inferSelect,
  'accountId' | 'itemId'
> & {
  item: NullableItem;
};
export type ActionWithItemAndAccount = ActionWithItem & {
  account: NullableAccount;
};

// --- ChatMessage
export type ChatMessageInsertDTO = typeof chatMessagesTable.$inferInsert;
export type ChatMessageRaw = typeof chatMessagesTable.$inferSelect;
export type ChatMessageWithCreator = Omit<ChatMessageRaw, 'creatorId'> & {
  creator: NullableAccount;
};
export type ChatMessageWithCreatorAndItem = Omit<
  ChatMessageWithCreator,
  'itemId'
> & {
  item: Item;
};

// --- ChatMentions
export type ChatMentionRaw = typeof chatMentionsTable.$inferSelect;
export type ChatMentionWithMessageAndCreator = Omit<
  ChatMentionRaw,
  'accountId' | 'messageId'
> & {
  account: MinimalAccount;
  message: ChatMessageRaw;
};

// --- Invitations
export type InvitationInsertDTO = typeof invitationsTable.$inferInsert;
export type InvitationRaw = typeof invitationsTable.$inferSelect;
export type InvitationWithItem = Omit<InvitationRaw, 'itemPath'> & {
  item: Item;
};
export type InvitationWIthItemAndCreator = Omit<
  InvitationWithItem,
  'creatorId'
> & {
  creator: NullableAccount;
};

// --- ItemTags
export type ItemTagInsertDTO = typeof itemTags.$inferInsert;
export type ItemTagRaw = typeof itemTags.$inferSelect;

// --- ItemMembership
export type ItemMembershipRaw = typeof itemMemberships.$inferSelect;
export type ItemMembershipWithItem = Omit<ItemMembershipRaw, 'itemPath'> & {
  item: Item;
};
export type ItemMembershipWithItemAndAccount = Omit<
  ItemMembershipWithItem,
  'accountId'
> & {
  account: MinimalAccount;
};

// --- AppAction
export type AppActionRaw = typeof appActions.$inferSelect;
export type AppActionWithItemAndAccount = AppActionRaw & {
  item: Item;
  account: MinimalAccount;
};
