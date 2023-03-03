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

import { Item } from '../../item/entities/Item';
import { Member } from '../../member/entities/member';

@Entity()
@Unique('id', ['id'])
export class ItemPublished extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'creator_id' })
  creator: Member;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Item, (item) => item.path, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ referencedColumnName: 'path', name: 'item_path' })
  item: Item;
}
