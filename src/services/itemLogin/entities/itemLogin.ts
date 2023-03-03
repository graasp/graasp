import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { Member } from '../../member/entities/member';
import { ItemLoginSchema } from './itemLoginSchema';

@Entity()
@Unique('item-login-member', ['itemLoginSchema', 'member'])
export class ItemLogin extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  // relation to item from item login schema
  // TODO? on delete cascade?
  @ManyToOne(() => ItemLoginSchema, (iLS) => iLS.id, {
    onDelete: 'CASCADE',
  })
  itemLoginSchema: ItemLoginSchema;

  // @ManyToOne(() => Item, (item) => item.path, {
  //   onUpdate: 'CASCADE',
  //   onDelete: 'CASCADE',
  // })
  // @JoinColumn({ referencedColumnName: 'path', name: 'item_path' })
  // item: Item;

  // password can be null if schema is username only
  @Column({
    length: 100,
    nullable: true,
  })
  password: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
