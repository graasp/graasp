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

import { ItemValidationProcess, ItemValidationStatus } from '@graasp/sdk';

import { Item } from '../../../../entities/Item';
import { ItemValidationGroup } from './ItemValidationGroup';

@Entity()
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
    type: 'character varying',
    enum: Object.values(ItemValidationProcess),
  })
  process: `${ItemValidationProcess}`;

  @Column({
    nullable: false,
    type: 'character varying',
    enum: Object.values(ItemValidationStatus),
  })
  status: ItemValidationStatus;

  @Column({
    nullable: true,
    type: 'character varying',
  })
  result: string;

  @ManyToOne(() => ItemValidationGroup, (ivg) => ivg.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'item_validation_group_id' })
  itemValidationGroup: ItemValidationGroup;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
