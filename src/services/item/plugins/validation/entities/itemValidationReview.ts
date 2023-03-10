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
@Unique('id', ['id'])
export class ItemValidationReview extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ItemValidation, (iv) => iv.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'item_validation_id' })
  itemValidation: ItemValidation;

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer: Member;

  @Column({
    nullable: false,
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
