import {
  BaseEntity,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

import { Item } from '../../../../item/entities/Item';
import { Member } from '../../../../member/entities/member';

@Entity()
@Unique('UQ_membership_request_item-member', ['item', 'member'])
export class MembershipRequest extends BaseEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_membership_request_id' })
  id: string;

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'member_id', foreignKeyConstraintName: 'FK_membership_request_member_id' })
  member: Member;

  @ManyToOne(() => Item, (item) => item.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'item_id', foreignKeyConstraintName: 'FK_membership_request_item_id' })
  item: Item;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;
}
