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

import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';

export type Filters = {
  visibility?: AppDataVisibility;
  memberId?: Member['id'];
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

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Member | null;

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  @Index()
  @Column({
    nullable: false,
    length: 25,
  })
  type: string;

  @Column({
    nullable: false,
  })
  visibility: AppDataVisibility;

  @Column('simple-json', { nullable: false, default: '{}' })
  data: { [key: string]: unknown };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
