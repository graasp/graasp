import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 } from 'uuid';

import { Item } from '../item/entities/Item.js';
import { Member } from '../member/entities/member.js';

@Entity()
export class ChatMessage extends BaseEntity {
  // we do not generate by default because if need to generate
  // the id to define the path
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Item, (item) => item.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @ManyToOne(() => Member, (member) => member.id, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'creator_id' })
  creator: Member | null;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: false })
  updatedAt: Date;

  @Column({
    nullable: false,
    length: 500,
  })
  body: string;
}
