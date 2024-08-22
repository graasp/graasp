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

import { MentionStatus } from '@graasp/sdk';

import { Account } from '../../../account/entities/account';
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

  @ManyToOne(() => Account, (account) => account.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'FK_chat_mention_account_id' })
  account: Account;

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
