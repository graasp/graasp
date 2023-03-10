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

import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemValidationGroup } from './ItemValidationGroup';

// export interface GraaspPluginValidationOptions {
//   // classifierApi is the host api of the container running the image classifier
//   classifierApi: string;
//   fileItemType: FileItemType;
//   fileConfigurations: { s3: S3FileConfiguration; local: LocalFileConfiguration };
// }

// export type SetEnabledForItemValidationProcessTaskInput = {
//   enabled: boolean;
// };

// export type UpdateItemValidationReviewTaskInput = {
//   status?: string;
//   reason?: string;
// };

// export type contentForValidation = {
//   name: string;
//   value: string;
// };

@Entity()
@Unique('id', ['id'])
export class ItemValidation extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** validation over this item, that might be a child of the group's item */
  @ManyToOne(() => Item, (item) => item.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({
    nullable: false,
  })
  process: ItemValidationProcess;

  @Column({
    nullable: false,
  })
  status: ItemValidationStatus;

  @Column({
    nullable: true,
  })
  result: string;

  @ManyToOne(() => ItemValidationGroup, (ivg) => ivg.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'item_validation_group_id' })
  itemValidationGroup: ItemValidationGroup;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: string;
}

// export type FullValidationRecord = {
//   id: string;
//   itemId: string;
//   reviewStatusId: string;
//   validationStatusId: string;
//   validationResult: string;
//   process: string;
//   createdAt: string;
// };

// export type ItemValidationAndReview = {
//   itemValidationId: string;
//   reviewStatusId: string;
//   reviewReason: string;
//   createdAt: string;
// };

// export type ItemValidationStatus = {
//   id: string;
//   name: string;
// };

// export type ItemValidationReviewStatus = {
//   id: string;
//   name: string;
// };
