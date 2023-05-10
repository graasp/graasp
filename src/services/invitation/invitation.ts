import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { v4 } from 'uuid';

import { Invitation as GraaspInvitation, PermissionLevel } from '@graasp/sdk';

import { Item } from '../item/entities/Item';
import { Member } from '../member/entities/member';

@Entity()
@Unique('item-email', ['item', 'email'])
export class Invitation extends BaseEntity implements GraaspInvitation {
  // we do not generate by default because if need to generate
  // the id to define the path
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Member | null;

  @Column({ nullable: false })
  permission: PermissionLevel;

  @Column({ length: 100, nullable: true })
  name: string;

  @Column({ length: 100, nullable: false })
  email: string;

  @ManyToOne(() => Item, (item) => item.path, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ referencedColumnName: 'path', name: 'item_path' })
  item: Item;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
