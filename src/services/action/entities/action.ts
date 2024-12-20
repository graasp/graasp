import geoip from 'geoip-lite';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Context } from '@graasp/sdk';

import { Account } from '../../account/entities/account';
import { Item } from '../../item/entities/Item';

@Entity()
export class Action extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_action_account_id')
  @ManyToOne(() => Account, (account) => account.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'FK_action_account_id' })
  account?: Account | null;

  /**
   * action can be related to a behavior not related to an item
   */
  @Index()
  @ManyToOne(() => Item, (item) => item.path, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ referencedColumnName: 'id', name: 'item_id' })
  item?: Item | null;
  @Column({
    nullable: false,
    enum: Object.values(Context),
  })
  view: Context;

  @Column({
    nullable: false,
  })
  type: string;

  @Column('simple-json', { nullable: false })
  extra: { [key: string]: unknown };

  @Column('simple-json', { nullable: true, default: null })
  geolocation?: geoip.Lookup;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
