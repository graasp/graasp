import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { v4 } from 'uuid';

import { Account } from '../../../../account/entities/account';
import { Item } from '../../../entities/Item';

@Entity()
export class AppAction extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Item, (item) => item.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @ManyToOne(() => Account, (account) => account.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'FK_app_action_account_id' })
  account: Account;

  @Column({
    nullable: false,
    length: 25,
    type: 'character varying',
  })
  type: string;

  @Column('simple-json', { nullable: false, default: '{}' })
  data: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
