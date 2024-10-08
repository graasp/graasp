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

import { Account } from '../account/entities/account';
import { Item } from '../item/entities/Item';
import { Guest } from '../itemLogin/entities/guest';
import { Member } from '../member/entities/member';

@Entity()
export class ChatMessage extends BaseEntity {
  // we do not generate by default because if need to generate
  // the id to define the path
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Item, (item) => item.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @ManyToOne(() => Account, (account) => account.id, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'creator_id' })
  creator: Guest | Member | null;

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
