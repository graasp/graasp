import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { v4 } from 'uuid';

import { ItemTagType } from '@graasp/sdk';

import { Member } from '../../../member/entities/member.js';
import { Item } from '../../entities/Item.js';

@Entity()
@Index('IDX_gist_item_tag_path', { synchronize: false })
@Unique('item-tag', ['item', 'type'])
export class ItemTag extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Member | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ nullable: false, enum: Object.values(ItemTagType) })
  type: ItemTagType;

  @ManyToOne(() => Item, (item) => item.path, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ referencedColumnName: 'path', name: 'item_path' })
  item: Item;
}
