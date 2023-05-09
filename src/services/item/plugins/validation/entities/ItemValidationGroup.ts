import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ItemValidationGroup as GraaspItemValidationGroup } from '@graasp/sdk';

import { Item } from '../../../entities/Item';
import { ItemValidation } from './ItemValidation';

@Entity()
export class ItemValidationGroup extends BaseEntity implements GraaspItemValidationGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Item, (item) => item.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => ItemValidation, (iv) => iv.itemValidationGroup)
  itemValidations: ItemValidation[];
}
