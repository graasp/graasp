import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
  UpdateDateColumn,
} from 'typeorm';
import { v4 } from 'uuid';

import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';

@Entity()
@Index(['item', 'name'])
export class AppSetting extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Item, (item) => item.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  // @RelationId is a decorator used at the entity level. It doesn't modify the database schema itself.
  // It simply tells to fetch the related entity ID during data retrieval, allowing to keep the foreign key without join.
  @RelationId((appSetting: AppSetting) => appSetting.item)
  itemId: string;

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'creator_id' })
  creator?: Member | null;

  // @RelationId is a decorator used at the entity level. It doesn't modify the database schema itself.
  // It simply tells to fetch the related entity ID during data retrieval, allowing to keep the foreign key without join.
  @RelationId((appSetting: AppSetting) => appSetting.creator)
  creatorId: string;

  @Column({
    nullable: false,
  })
  name: string;

  @Column('simple-json', { nullable: false, default: '{}' })
  data: { [key: string]: unknown };

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: false })
  updatedAt: Date;
}
