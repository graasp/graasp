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

import { Item } from '../item/entities/Item';
import { Member } from '../member/entities/member';

export enum FlagType {
  INAPPROPRIATE_CONTENT = 'inappropriate-content',
  HATE_SPEECH = 'hate-speech',
  FRAUD_PLAGIARISM = 'fraud-plagiarism',
  SPAM = 'spam',
  TARGETED_HARASMENT = 'targeted-harrasment',
  FALSE_INFORMATION = 'false-information',
}

@Entity()
@Unique('id', ['id'])
@Unique('item-flag-creator', ['item', 'flagType', 'creator'])
export class ItemFlag extends BaseEntity {
  // we do not generate by default because if need to generate
  // the id to define the path
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @Column({ name: 'flag_type' })
  flagType: FlagType;

  @ManyToOne(() => Item, (item) => item.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Member;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
