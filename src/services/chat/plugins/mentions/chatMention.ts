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

import { MentionStatus } from '@graasp/sdk';

import { Member } from '../../../member/entities/member';
import { ChatMessage } from '../../chatMessage';

@Entity()
export class ChatMention extends BaseEntity {
  // we do not generate by default because if need to generate
  // the id to define the path
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => ChatMessage, (chatMessage) => chatMessage.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: ChatMessage;

  // @RelationId is a decorator used at the entity level. It doesn't modify the database schema itself.
  // It simply tells to fetch the related entity ID during data retrieval, allowing to keep the foreign key without join.
  @RelationId((chatMention: ChatMention) => chatMention.message)
  messageId: string;

  @ManyToOne(() => Member, (member) => member.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  // @RelationId is a decorator used at the entity level. It doesn't modify the database schema itself.
  // It simply tells to fetch the related entity ID during data retrieval, allowing to keep the foreign key without join.
  @RelationId((chatMention: ChatMention) => chatMention.member)
  memberId: string;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: false })
  updatedAt: Date;

  @Column({
    type: 'enum',
    enum: Object.values(MentionStatus),
    nullable: false,
    default: MentionStatus.Unread,
  })
  status: MentionStatus;
}
