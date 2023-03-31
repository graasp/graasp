import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { v4 } from 'uuid';

import { Member } from '../../../member/entities/member';
import { Item } from '../../entities/Item';

@Entity()
@Unique('recycled-item-data', ['item'])
export class RecycledItemData extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
    nullable: false,
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Member;

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
