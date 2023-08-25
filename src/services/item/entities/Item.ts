import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 } from 'uuid';

import {
  AppItemExtra,
  DocumentItemExtra,
  EmbeddedLinkItemExtra,
  EtherpadItemExtra,
  FolderItemExtra,
  H5PItemExtra,
  ItemSettings,
  ItemType,
  LocalFileItemExtra,
  MAX_ITEM_NAME_LENGTH,
  S3FileItemExtra,
  ShortcutItemExtra,
} from '@graasp/sdk';

import { Member } from '../../member/entities/member';

// Map of the item types to their item extra
export type ItemExtraMap = {
  [ItemType.APP]: AppItemExtra;
  [ItemType.DOCUMENT]: DocumentItemExtra;
  [ItemType.ETHERPAD]: EtherpadItemExtra;
  [ItemType.FOLDER]: FolderItemExtra;
  [ItemType.H5P]: H5PItemExtra;
  [ItemType.LINK]: EmbeddedLinkItemExtra;
  [ItemType.LOCAL_FILE]: LocalFileItemExtra;
  [ItemType.S3_FILE]: S3FileItemExtra;
  [ItemType.SHORTCUT]: ShortcutItemExtra;
};

// utility type to describe the union of the potential item extras before the `type` of an item is known or checked using a typeguard
export type ItemExtraUnion = ItemExtraMap[keyof ItemExtraMap];

// local type alias to simplify the notation
type ItemTypeKeys = keyof ItemExtraMap;

@Entity()
@Index('IDX_gist_item_path', { synchronize: false })
export class Item<T extends ItemTypeKeys = ItemTypeKeys> extends BaseEntity {
  // we do not generate by default because if need to generate
  // the id to define the path
  @PrimaryColumn('uuid', { nullable: false })
  id: string = v4();

  @Column({
    length: MAX_ITEM_NAME_LENGTH,
    nullable: false,
  })
  name: string;

  @Column({
    nullable: true,
    length: 5000,
  })
  description: string;

  @Column({
    default: ItemType.FOLDER,
    nullable: false,
    enum: Object.values(ItemType),
  })
  type: T;

  @Index()
  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Member | null;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: false })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;

  // type dependent properties
  @Column('simple-json', { nullable: false })
  extra: ItemExtraMap[T]; // extra is typed using the generic to match the type property of the item

  // cosmetic settings
  // do not set default value because it gets serialize as a string in map.values()
  @Column('simple-json', { nullable: false })
  settings: ItemSettings;

  @Column('ltree', { unique: true, nullable: false })
  path: string;

  // we cannot link to path-related items with inheritance
  // because we need path <@
  // @ManyToMany(() => ItemCategory, (iC) => iC.item)
  // categories: ItemCategory[];
}

// all sub-item types defined using a specific variant of the `ItemType` enumeration
export type AppItem = Item<typeof ItemType.APP>;
export type DocumentItem = Item<typeof ItemType.DOCUMENT>;
export type EtherpadItem = Item<typeof ItemType.ETHERPAD>;
export type FolderItem = Item<typeof ItemType.FOLDER>;
export type H5PItem = Item<typeof ItemType.H5P>;
export type EmbeddedLinkItem = Item<typeof ItemType.LINK>;
export type LocalFileItem = Item<typeof ItemType.LOCAL_FILE>;
export type S3FileItem = Item<typeof ItemType.S3_FILE>;
export type ShortcutItem = Item<typeof ItemType.SHORTCUT>;

// Typeguard definitons that help to narrow the type of an item to one of the specific item types
// typeguard are used because a class does not support discriminated union
// (which are the recommented way of achieving what we have with the item type definiton)
// One benefit of using the typeguards is that it shortens the code when checking for an item type:
// Before:
//          if (item.type === ItemType.FOO) {
//            // item.extra was not correctly typed to the correcponding extra type
//            // do something, but you will have to cast the item.extra ... not ideal
//          }
//
// Now:
//          if (isFooItem(item)) {
//            // now item.extra is of the mapped type, i.e: FooItemExtra
//            // do some smarter things without needing to cast the extra
//          }
export const isAppItem = (item: Item<ItemTypeKeys>): item is AppItem => item.type === ItemType.APP;
export const isDocumentItem = (item: Item<ItemTypeKeys>): item is DocumentItem =>
  item.type === ItemType.DOCUMENT;
export const isEtherpadItem = (item: Item<ItemTypeKeys>): item is EtherpadItem =>
  item.type === ItemType.ETHERPAD;
export const isFolderItem = (item: Item<ItemTypeKeys>): item is FolderItem =>
  item.type === ItemType.FOLDER;
export const isH5PItem = (item: Item<ItemTypeKeys>): item is H5PItem => item.type === ItemType.H5P;
export const isEmbeddedLinkItem = (item: Item<ItemTypeKeys>): item is EmbeddedLinkItem =>
  item.type === ItemType.LINK;
export const isLocalFileItem = (item: Item<ItemTypeKeys>): item is LocalFileItem =>
  item.type === ItemType.LOCAL_FILE;
export const isS3FileItem = (item: Item<ItemTypeKeys>): item is S3FileItem =>
  item.type === ItemType.S3_FILE;
export const isShortcutItem = (item: Item<ItemTypeKeys>): item is ShortcutItem =>
  item.type === ItemType.SHORTCUT;
