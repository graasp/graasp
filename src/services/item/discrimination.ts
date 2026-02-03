import type { ItemTypeEnumKeys, ItemWithType } from '../../drizzle/types';
import { ItemType } from '../../schemas/global';

export type AppItem = ItemWithType<'app'>;
export type DocumentItem = ItemWithType<'document'>;
export type EtherpadItem = ItemWithType<'etherpad'>;
export type FolderItem = ItemWithType<'folder'>;
// For now a capsule is a folder with one different setting
export type CapsuleItem = FolderItem;
export type PageItem = ItemWithType<'page'>;
export type H5PItem = ItemWithType<'h5p'>;
export type EmbeddedLinkItem = ItemWithType<'embeddedLink'>;
export type FileItem = ItemWithType<'file'>;
export type ShortcutItem = ItemWithType<'shortcut'>;

export const isItemType = <T extends ItemTypeEnumKeys>(
  item: { type: ItemType },
  type: T,
): item is ItemWithType<T> => {
  return item.type === type;
};
