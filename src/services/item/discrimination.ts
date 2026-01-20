import { ItemType } from '@graasp/sdk';

import type { ItemRaw, ItemTypeEnumKeys, ItemWithType } from '../../drizzle/types';

export type AppItem = ItemWithType<typeof ItemType.APP>;
export type DocumentItem = ItemWithType<typeof ItemType.DOCUMENT>;
export type EtherpadItem = ItemWithType<typeof ItemType.ETHERPAD>;
export type FolderItem = ItemWithType<typeof ItemType.FOLDER>;
// For now a capsule is a folder with one different setting
export type CapsuleItem = FolderItem;
export type PageItem = ItemWithType<typeof ItemType.PAGE>;
export type H5PItem = ItemWithType<typeof ItemType.H5P>;
export type EmbeddedLinkItem = ItemWithType<typeof ItemType.LINK>;
export type FileItem = ItemWithType<typeof ItemType.FILE>;
export type ShortcutItem = ItemWithType<typeof ItemType.SHORTCUT>;

export const isItemType = <T extends ItemTypeEnumKeys>(
  item: { type: ItemRaw['type'] },
  type: T,
): item is ItemWithType<T> => {
  return item.type === type;
};
