import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { ItemValidationReviewStatus } from '@graasp/sdk';

import { Member } from '../../../../member/entities/member';
import { ItemValidation } from './ItemValidation';

@Entity()
export class ItemValidationReview extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ItemValidation, (iv) => iv.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'item_validation_id' })
  itemValidation: ItemValidation;

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: Member | null;

  @Column({
    nullable: false,
    enum: Object.values(ItemValidationReviewStatus),
  })
  status: ItemValidationReviewStatus;

  @Column({
    nullable: true,
  })
  reason: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: string;
}
