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

import { ItemMembership as GraaspItemMembership, PermissionLevel } from '@graasp/sdk';

import { Item } from '../../item/entities/Item';
import { Member } from '../../member/entities/member';

@Entity()
@Unique('item_membership-item-member', ['item', 'member'])
export class ItemMembership extends BaseEntity implements GraaspItemMembership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    length: 100,
    nullable: false,
    enum: Object.values(PermissionLevel),
  })
  @Index()
  permission: PermissionLevel;

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Member | null;

  @Index()
  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'member_id' })
  member: Member;

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
