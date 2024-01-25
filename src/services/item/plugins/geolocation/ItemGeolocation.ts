import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { v4 } from 'uuid';

import { Item } from '../../entities/Item';

@Entity({ name: 'item_geolocation' })
@Unique('item_geolocation_unique_item', ['item'])
export class ItemGeolocation extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  // inherit from parent
  @OneToOne(() => Item, (item) => item.path, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ referencedColumnName: 'path', name: 'item_path' })
  item: Item;

  @Column({ type: 'float' })
  lat: number;

  @Column({ type: 'float' })
  lng: number;

  @Column({ type: 'character varying', nullable: true, length: 4 })
  country: string | null;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;

  @CreateDateColumn({ name: 'updated_at', nullable: false })
  updatedAt: Date;
}
