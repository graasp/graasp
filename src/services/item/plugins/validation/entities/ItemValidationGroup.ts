import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';
import { ItemValidation } from './ItemValidation';

@Entity()
@Unique('id', ['id'])
export class ItemValidationGroup extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Item, (item) => item.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: string;

  @OneToMany(() => ItemValidation, (iv) => iv.id)
  // @JoinColumn({ name: 'item_validation_ids' })
  itemValidations: ItemValidation[];
}
