import { ItemType } from '@graasp/sdk';

import { Item, ItemTypeEnumKeys, ItemWithType } from '../../drizzle/types';

export type AppItem = ItemWithType<typeof ItemType.APP>;
export type DocumentItem = ItemWithType<typeof ItemType.DOCUMENT>;
export type EtherpadItem = ItemWithType<typeof ItemType.ETHERPAD>;
export type FolderItem = ItemWithType<typeof ItemType.FOLDER>;
export type H5PItem = ItemWithType<typeof ItemType.H5P>;
export type EmbeddedLinkItem = ItemWithType<typeof ItemType.LINK>;
export type LocalFileItem = ItemWithType<typeof ItemType.LOCAL_FILE>;
export type S3FileItem = ItemWithType<typeof ItemType.S3_FILE>;
export type ShortcutItem = ItemWithType<typeof ItemType.SHORTCUT>;

export const isItemType = <T extends ItemTypeEnumKeys>(
  item: Item,
  type: T,
): item is ItemWithType<T> => {
  return item.type === type;
};
