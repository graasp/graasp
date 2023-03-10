import { FlagType } from '@graasp/sdk';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { v4 } from 'uuid';

import { Item } from '../item/entities/Item';
import { Member } from '../member/entities/member';


@Entity()
@Unique('id', ['id'])
@Unique('item-flag-creator', ['item', 'type', 'creator'])
export class ItemFlag extends BaseEntity {
  // we do not generate by default because if need to generate
  // the id to define the path
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @Column({ name: 'flag_type' })
  type: FlagType;

  @ManyToOne(() => Item, (item) => item.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Member;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
