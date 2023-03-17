import {
  BaseEntity,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { v4 } from 'uuid';

import {  ItemType, UnknownExtra } from '@graasp/sdk';

import { Member } from '../../member/entities/member';
import { DocumentExtra } from '../plugins/document';
import { EmbeddedLinkItemExtra } from '../plugins/embeddedLink';

export interface FolderExtra extends UnknownExtra {
  [ItemType.FOLDER]: {
    childrenOrder?: string[];
  };
}

// TODO: add in sdk?
export type ItemExtra = FolderExtra | DocumentExtra | EmbeddedLinkItemExtra;

export type ItemSettings = {
  tags?: string[];
  isPinned?: boolean;
  showChatbox?: boolean;
  hasThumbnail?: boolean;
  isResizable?: boolean;
  isCollapsible?: boolean;
};

@Entity()
@Unique('id', ['id'])
export class Item extends BaseEntity {
  // we do not generate by default because if need to generate
  // the id to define the path
  @PrimaryColumn('uuid', { nullable: false })
  id: string = v4();

  @Column({
    length: 100,
    nullable: false,
  })
  name: string;

  @Column({
    nullable: true,
    length: 100,
  })
  description: string;

  @Column({
    default: ItemType.FOLDER,
    nullable: false,
  })
  type: `${ItemType}`;

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Member;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: false })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: false })
  deletedAt: Date;

  // type dependent properties
  @Column('simple-json', { nullable: false })
  extra: any;

  // cosmetic settings
  @Column('simple-json', { nullable: false, default: '{}' })
  settings: ItemSettings;

  // return path
  // https://github.com/typeorm/typeorm/issues/4232#issuecomment-585162991
  // @VirtualColumn

  @Column('ltree', { unique: true, nullable: false })
  path: string;

  // we cannot link to path-related items with inheritance
  // because we need path <@
  // @ManyToMany(() => ItemCategory, (iC) => iC.item)
  // categories: ItemCategory[];
}
