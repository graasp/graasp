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

import { ItemVisibilityType } from '@graasp/sdk';

import { Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';

@Entity()
@Index('IDX_gist_item_visibility_path', { synchronize: false })
@Unique('UQ_item_visibility_item_type', ['item', 'type'])
export class ItemVisibility extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'creator_id', foreignKeyConstraintName: 'FK_item_visibility_creator' })
  creator: Member | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ nullable: false, enum: Object.values(ItemVisibilityType) })
  type: ItemVisibilityType;

  @ManyToOne(() => Item, (item) => item.path, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    referencedColumnName: 'path',
    name: 'item_path',
    foreignKeyConstraintName: 'FK_item_visibility_item',
  })
  item: Item;
}
