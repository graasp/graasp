import {
  AfterLoad,
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { v4 } from 'uuid';

import { ItemType, UnknownExtra } from '@graasp/sdk';

import { Member } from '../../../../member/entities/member';
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

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Column({
    nullable: false,
  })
  type: string;

  @Column('simple-json', { nullable: false, default: '{}' })
  data: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
