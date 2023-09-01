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
  EmbeddedLinkItemExtra,
  EtherpadItemExtra,
  FolderItemExtra,
  Item as GraaspItem,
  H5PItemExtra,
  ItemSettings,
  ItemType,
  LocalFileItemExtra,
  MAX_ITEM_NAME_LENGTH,
  S3FileItemExtra,
  ShortcutItemExtra,
} from '@graasp/sdk';

import { Member } from '../../member/entities/member';
import { DocumentExtra } from '../plugins/document';

export type ItemExtra =
  | DocumentExtra
  | FolderItemExtra
  | EmbeddedLinkItemExtra
  | H5PItemExtra
  | LocalFileItemExtra
  | ShortcutItemExtra
  | EtherpadItemExtra
  | S3FileItemExtra
  | AppItemExtra;

@Entity()
@Index('IDX_gist_item_path', { synchronize: false })
export class Item extends BaseEntity implements GraaspItem {
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
  type: `${ItemType}`;

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
  extra: ItemExtra;

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
