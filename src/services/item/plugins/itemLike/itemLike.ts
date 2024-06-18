import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { v4 } from 'uuid';

import { Item } from '../../../item/entities/Item.js';
import { Member } from '../../../member/entities/member.js';

@Entity()
@Unique('id', ['creator', 'item'])
export class ItemLike extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Member;

  @ManyToOne(() => Item, (item) => item.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
