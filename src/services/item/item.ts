import {
  AppItemExtra,
  DocumentItemExtra,
  EtherpadItemExtra,
  FolderItemExtra,
  H5PItemExtra,
  LinkItemExtra,
  LinkItemSettings,
  ShortcutItemExtra,
} from '@graasp/sdk';

import { items } from '../../drizzle/schema';

/**
 * Raw return type given when retrieveing from the db.
 */
export type ItemRaw = typeof items.$inferSelect;

export type PageItem = Omit<ItemRaw, 'type'> & { type: 'page' };
export const isPageItem = (item: ItemRaw): item is DocumentItem => item.type === 'page';

export type DocumentItem = Omit<ItemRaw, 'type'> & { type: 'document'; extra: DocumentItemExtra };
export const isDocumentItem = (item: ItemRaw): item is DocumentItem => item.type === 'document';

export type EtherpadItem = Omit<ItemRaw, 'type'> & { type: 'etherpad'; extra: EtherpadItemExtra };
export const isEtherpadItem = (item: ItemRaw): item is EtherpadItem => item.type === 'etherpad';

export type AppItem = Omit<ItemRaw, 'type'> & { type: 'app'; extra: AppItemExtra };
export const isAppItem = (item: ItemRaw): item is AppItem => item.type === 'app';

export type FolderItem = Omit<ItemRaw, 'type'> & { type: 'folder'; extra: FolderItemExtra };
export type CapsuleItem = Omit<ItemRaw, 'type'> & { type: 'folder'; extra: FolderItemExtra };
export const isFolderItem = (item: ItemRaw): item is FolderItem => item.type === 'folder';

export type H5PItem = Omit<ItemRaw, 'type'> & {
  type: 'h5p';
  extra: H5PItemExtra;
};
export const isH5PItem = (item: ItemRaw): item is H5PItem => item.type === 'h5p';

export type EmbeddedLinkItem = Omit<ItemRaw, 'type'> & {
  type: 'embeddedLink';
  extra: LinkItemExtra;
  settings: LinkItemSettings;
};
export const isEmbeddedLinkItem = (item: ItemRaw): item is EmbeddedLinkItem =>
  item.type === 'embeddedLink';

export type FileItem = Omit<ItemRaw, 'type'> & {
  type: 'file';
  extra: {
    file: {
      name: string;
      path: string;
      mimetype: string;
      size: number;
      altText?: string;
      content?: string;
      /** @deprecated */
      key?: string;
      /** @deprecated */
      contenttype?: string;
    };
  };
};
export const isFileItem = (item: ItemRaw): item is FileItem => item.type === 'file';

export type ShortcutItem = Omit<ItemRaw, 'type'> & { type: 'shortcut'; extra: ShortcutItemExtra };
export const isShortcutItem = (item: ItemRaw): item is ShortcutItem => item.type === 'shortcut';

export type Item =
  | PageItem
  | DocumentItem
  | AppItem
  | EtherpadItem
  | FolderItem
  | H5PItem
  | EmbeddedLinkItem
  | FileItem
  | ShortcutItem;

export const resolveItemType = (item: ItemRaw) => {
  switch (item.type) {
    case 'app':
      return item as AppItem;
    case 'document':
      return item as DocumentItem;
    case 'etherpad':
      return item as EtherpadItem;
    case 'folder':
      return item as FolderItem;
    case 'h5p':
      return item as H5PItem;
    case 'embeddedLink':
      return item as EmbeddedLinkItem;
    case 'file':
      return item as FileItem;
    case 'shortcut':
      return item as ShortcutItem;
    case 'page':
      return item as PageItem;
  }
};
