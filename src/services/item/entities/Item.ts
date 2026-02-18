import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 } from 'uuid';

import {
  AppItemExtra,
  DocumentItemExtra,
  FolderItemExtra,
  ItemSettings,
  ItemType,
  LinkItemExtra,
  LinkItemSettings,
  LocalFileItemExtra,
  MAX_ITEM_NAME_LENGTH,
  S3FileItemExtra,
  ShortcutItemExtra,
} from '@graasp/sdk';

import { Member } from '../../member/entities/member';
import { ItemGeolocation } from '../plugins/geolocation/ItemGeolocation';

// Map of the item types to their item extra
export type ItemExtraMap = {
  [ItemType.APP]: AppItemExtra;
  [ItemType.DOCUMENT]: DocumentItemExtra;
  [ItemType.FOLDER]: FolderItemExtra;
  [ItemType.LINK]: LinkItemExtra;
  [ItemType.LOCAL_FILE]: LocalFileItemExtra;
  [ItemType.S3_FILE]: S3FileItemExtra;
  [ItemType.SHORTCUT]: ShortcutItemExtra;
};

// Map of the item types to their item extra
export type ItemSettingsMap = {
  [ItemType.APP]: ItemSettings;
  [ItemType.DOCUMENT]: ItemSettings;
  [ItemType.FOLDER]: ItemSettings;
  [ItemType.LINK]: LinkItemSettings;
  [ItemType.LOCAL_FILE]: ItemSettings;
  [ItemType.S3_FILE]: ItemSettings;
  [ItemType.SHORTCUT]: ItemSettings;
};

/** insert at beginning by default, so we need some margin */
export const DEFAULT_ORDER = 20;

// utility type to describe the union of the potential item extras before the `type` of an item is known or checked using a typeguard
export type ItemExtraUnion = ItemExtraMap[keyof ItemExtraMap];

// local type alias to simplify the notation
export type ItemTypeEnumKeys = keyof ItemExtraMap;
// since we use an enum for ItemType, the keyof opperator in nominaly typed. To use a union type with litteral values we should convert ItemType to a const object
// this is how you would get the litteral union from the nominal types but this does not work to index into ItemExtraMap in Item Entity...
// type ItemTypeRawKeys = `${ItemTypeEnumKeys}`;

@Entity()
@Index('IDX_gist_item_path', { synchronize: false })
@Index('IDX_gin_item_search_document', { synchronize: false })
export class Item<T extends ItemTypeEnumKeys = ItemTypeEnumKeys> extends BaseEntity {
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
    type: 'character varying',
  })
  description: string | null;

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
  deletedAt: Date | null;

  // type dependent properties
  @Column('simple-json', { nullable: false })
  extra: ItemExtraMap[T]; // extra is typed using the generic to match the type property of the item

  // cosmetic settings
  // do not set default value because it gets serialize as a string in map.values()
  @Column('simple-json', { nullable: false })
  settings: ItemSettingsMap[T];

  @Column('ltree', { unique: true, nullable: false })
  path: string;

  // we cannot link to path-related items with inheritance
  // because we need path <@
  // @ManyToMany(() => ItemCategory, (iC) => iC.item)
  // categories: ItemCategory[];

  @OneToOne(() => ItemGeolocation, (geoloc: ItemGeolocation) => geoloc.item, {
    onDelete: 'SET NULL',
  })
  geolocation: ItemGeolocation;

  // We don't use an enum because it might easily break if a new language is added in the frontend
  // plus this value should be at least the same set of member.extra.lang
  @Column({ nullable: false, default: 'en' })
  lang: string;

  @Column({
    type: 'numeric',
    default: null,
    select: false,
    nullable: true,
  })
  order: number | null;

  @Column({
    type: 'tsvector',
    generatedType: 'STORED',
    select: false,
    asExpression: `(
      setweight(to_tsvector('simple', name), 'A')  || ' ' ||
      setweight(to_tsvector('english', name), 'A') || ' ' ||
      setweight(to_tsvector('french', name), 'A') || ' ' || (
        case
            when lang='de' then to_tsvector('german', name)
            when lang='it' then to_tsvector('italian', name)
            when lang='es' then to_tsvector('spanish', name)
            else ' '
        end) || ' ' ||
      setweight(to_tsvector('english', COALESCE(description,'')), 'B') || ' ' ||
      setweight(to_tsvector('french', COALESCE(description,'')), 'B') || ' ' || (
        case
            when lang='de' then setweight(to_tsvector('german', COALESCE(description,'')), 'B')
            when lang='it' then setweight(to_tsvector('italian', COALESCE(description,'')), 'B')
            when lang='es' then setweight(to_tsvector('spanish', COALESCE(description,'')), 'B')
            else ' '
        end) || ' ' ||
      setweight(to_tsvector('english', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' ||
      setweight(to_tsvector('french', COALESCE(settings::jsonb->'tags','{}')), 'C') || ' ' || (
        case
            when lang='de' then setweight(to_tsvector('german', COALESCE(settings::jsonb->'tags','{}')), 'C')
            when lang='it' then setweight(to_tsvector('italian', COALESCE(settings::jsonb->'tags','{}')), 'C')
            when lang='es' then setweight(to_tsvector('spanish', COALESCE(settings::jsonb->'tags','{}')), 'C')
            else ' '
        end) || ' ' ||
      setweight(to_tsvector('english', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('french', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D') || ' ' || (
        case
            when lang='de' then setweight(to_tsvector('german', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D')
            when lang='it' then setweight(to_tsvector('italian', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D')
            when lang='es' then setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'document'->>'content','{}')), 'D')
            else ' '
        end) || ' ' ||
      setweight(to_tsvector('english', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('french', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D') || ' ' || (
        case
            when lang='de' then setweight(to_tsvector('german', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D')
            when lang='it' then setweight(to_tsvector('italian', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D')
            when lang='es' then setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'file'->'content','{}')), 'D')
            else ' '
        end) || ' ' ||
      setweight(to_tsvector('english', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' ||
      setweight(to_tsvector('french', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D') || ' ' || (
        case
            when lang='de' then setweight(to_tsvector('german', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D')
            when lang='it' then setweight(to_tsvector('italian', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D')
            when lang='es' then setweight(to_tsvector('spanish', COALESCE(replace(extra, '\\\\u0000', '')::jsonb->'s3File'->'content','{}')), 'D')
            else ' '
        end)
       ):: tsvector`,
  })
  search_document: string;
}

// all sub-item types defined using a specific variant of the `ItemType` enumeration
export type AppItem = Item<typeof ItemType.APP>;
export type DocumentItem = Item<typeof ItemType.DOCUMENT>;
export type FolderItem = Item<typeof ItemType.FOLDER>;
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

export const isItemType = <T extends ItemTypeEnumKeys>(
  item: Item<ItemTypeEnumKeys>,
  type: T,
): item is Item<T> => {
  return item.type === type;
};
