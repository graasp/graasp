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

import { FlagType } from '@graasp/sdk';

import { Account } from '../../../account/entities/account';
import { Item } from '../../../item/entities/Item';

@Entity()
@Unique('item-flag-creator', ['item', 'type', 'creator'])
export class ItemFlag extends BaseEntity {
  // we do not generate by default because if need to generate
  // the id to define the path
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @Column({ name: 'type', enum: Object.values(FlagType), nullable: false, type: 'varchar' })
  type: FlagType;

  @ManyToOne(() => Item, (item) => item.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @ManyToOne(() => Account, (account) => account.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Account;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
