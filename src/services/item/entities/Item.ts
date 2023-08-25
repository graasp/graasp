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

export type ItemExtra = {
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

export type ItemExtraUnion = ItemExtra[keyof ItemExtra];

type ItemTypeKeys = keyof ItemExtra;

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

  @DeleteDateColumn({ name: 'deleted_at', nullable: false })
  deletedAt: Date;

  // type dependent properties
  @Column('simple-json', { nullable: false })
  extra: ItemExtra[T];

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

export type AppItem = Item<typeof ItemType.APP>;
export type DocumentItem = Item<typeof ItemType.DOCUMENT>;
export type EtherpadItem = Item<typeof ItemType.ETHERPAD>;
export type FolderItem = Item<typeof ItemType.FOLDER>;
export type H5PItem = Item<typeof ItemType.H5P>;
export type EmbeddedLinkItem = Item<typeof ItemType.LINK>;
export type LocalFileItem = Item<typeof ItemType.LOCAL_FILE>;
export type S3FileItem = Item<typeof ItemType.S3_FILE>;
export type ShortcutItem = Item<typeof ItemType.SHORTCUT>;

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

// export type Item =
//   | AppItem
//   | DocumentItem
//   | EtherpadItem
//   | FolderItem
//   | H5PItem
//   | EmbeddedLinkItem
//   | LocalFileItem
//   | S3FileItem
//   | ShortcutItem;
