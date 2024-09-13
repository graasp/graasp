import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 } from 'uuid';

import { AppDataVisibility } from '@graasp/sdk';

import { Account } from '../../../../account/entities/account';
import { Item } from '../../../entities/Item';

export type Filters = {
  visibility?: AppDataVisibility;
  accountId?: Account['id'];
  type?: string;
};

@Entity()
export class AppData extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Item, (item) => item.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @ManyToOne(() => Account, (account) => account.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Account | null;

  @ManyToOne(() => Account, (account) => account.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'FK_app_data_account_id' })
  account: Account;

  @Index()
  @Column({
    nullable: false,
    length: 25,
    type: 'character varying',
  })
  type: string;

  @Column({
    nullable: false,
    type: 'character varying',
  })
  visibility: AppDataVisibility;

  @Column('simple-json', { nullable: false, default: '{}' })
  data: { [key: string]: unknown };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
