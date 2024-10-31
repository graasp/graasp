import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { v4 } from 'uuid';

import { Member } from '../../../member/entities/member';
import { PackedItem } from '../../ItemWrapper';
import { Item } from '../../entities/Item';

@Entity()
@Index('IDX_gist_recycled_item_data_item_path', { synchronize: false })
@Unique('recycled-item-data', ['item'])
export class RecycledItemData extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Member;

  @Index('IDX_recycled_item_data_created_at')
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Item, (item) => item.path, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ referencedColumnName: 'path', name: 'item_path' })
  item: Item;
}

export type PackedRecycledItemData = RecycledItemData & {
  item: PackedItem;
};
