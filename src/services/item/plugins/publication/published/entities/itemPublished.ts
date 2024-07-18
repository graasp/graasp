import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { v4 } from 'uuid';

import { Member } from '../../../../../member/entities/member';
import { PackedItem } from '../../../../ItemWrapper';
import { Item } from '../../../../entities/Item';

@Entity()
@Index('IDX_gist_item_published_path', { synchronize: false })
@Unique('published-item', ['item'])
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

  @OneToOne(() => Item, (item) => item.path, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ referencedColumnName: 'path', name: 'item_path' })
  item: Item;
}

export type PackedItemPublished = ItemPublished & {
  item: PackedItem;
};
