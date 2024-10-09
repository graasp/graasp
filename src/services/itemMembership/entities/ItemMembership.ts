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
  UpdateDateColumn,
} from 'typeorm';

import { PermissionLevel } from '@graasp/sdk';

import { Account } from '../../account/entities/account';
import { Item } from '../../item/entities/Item';
import { Guest } from '../../itemLogin/entities/guest';
import { Member } from '../../member/entities/member';

@Entity()
@Index('IDX_gist_item_membership_path', { synchronize: false })
@Unique('item_membership-item-member', ['item', 'account'])
export class ItemMembership extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    length: 100,
    nullable: false,
    enum: Object.values(PermissionLevel),
    type: 'varchar',
  })
  @Index()
  permission: PermissionLevel;

  @ManyToOne(() => Account, (account) => account.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Member | Guest | null;

  @Index('IDX_item_membership_account_id')
  @ManyToOne(() => Account, (account) => account.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'FK_item_membership_account_id' })
  account: Member | Guest;

  @ManyToOne(() => Item, (item) => item.path, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    nullable: false,
  })
  @Index()
  @JoinColumn({ referencedColumnName: 'path', name: 'item_path' })
  item: Item;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: false })
  updatedAt: Date;
}
