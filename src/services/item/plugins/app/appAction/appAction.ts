import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  RelationId,
} from 'typeorm';
import { v4 } from 'uuid';

import { Member } from '../../../../member/entities/member';
import { Item } from '../../../entities/Item';

@Entity()
export class AppAction extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @ManyToOne(() => Item, (item) => item.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  // TODO: check if wanted
  @RelationId((appAction: AppAction) => appAction.item)
  itemId: string;

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  // TODO: check if wanted
  @RelationId((appAction: AppAction) => appAction.member)
  memberId: string;

  @Column({
    nullable: false,
    length: 25,
  })
  type: string;

  @Column('simple-json', { nullable: false, default: '{}' })
  data: object;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
