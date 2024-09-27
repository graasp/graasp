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

import { ItemLoginSchemaStatus, ItemLoginSchemaType } from '@graasp/sdk';

import { Item } from '../../item/entities/Item';

@Entity()
@Unique('item-login-schema', ['item'])
export class ItemLoginSchema extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Item, (item) => item.path, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ referencedColumnName: 'path', name: 'item_path' })
  item: Item;

  @Column({
    enum: Object.values(ItemLoginSchemaType),
    nullable: false,
    length: 100,
  })
  type: `${ItemLoginSchemaType}` | ItemLoginSchemaType;

  @Column({
    enum: Object.values(ItemLoginSchemaStatus),
    default: ItemLoginSchemaStatus.Active,
    nullable: false,
    length: 100,
  })
  status: `${ItemLoginSchemaStatus}` | ItemLoginSchemaStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
