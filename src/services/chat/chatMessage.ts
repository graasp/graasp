import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';
import { v4 } from 'uuid';

import { Item } from '../item/entities/Item';
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

  // @RelationId is a decorator used at the entity level. It doesn't modify the database schema itself.
  // It simply tells to fetch the related entity ID during data retrieval, allowing to keep the foreign key without join.
  @RelationId((chatMessage: ChatMessage) => chatMessage.item)
  itemId: string;

  @ManyToOne(() => Member, (member) => member.id, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'creator_id' })
  creator: Member | null;

  // @RelationId is a decorator used at the entity level. It doesn't modify the database schema itself.
  // It simply tells to fetch the related entity ID during data retrieval, allowing to keep the foreign key without join.
  @RelationId((chatMessage: ChatMessage) => chatMessage.creator)
  creatorId: string;

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
