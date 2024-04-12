import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  Unique,
} from 'typeorm';
import { v4 } from 'uuid';

import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';

@Entity({ name: 'item_favorite' })
@Unique('favorite_key', ['member', 'item'])
export class ItemFavorite extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  // @RelationId is a decorator used at the entity level. It doesn't modify the database schema itself.
  // It simply tells to fetch the related entity ID during data retrieval, allowing to keep the foreign key without join.
  @RelationId((itemFavorite: ItemFavorite) => itemFavorite.member)
  memberId: string;

  @ManyToOne(() => Item, (item) => item.id, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  // @RelationId is a decorator used at the entity level. It doesn't modify the database schema itself.
  // It simply tells to fetch the related entity ID during data retrieval, allowing to keep the foreign key without join.
  @RelationId((itemFavorite: ItemFavorite) => itemFavorite.item)
  itemId: string;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;
}
