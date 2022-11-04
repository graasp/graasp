import { Entity, PrimaryGeneratedColumn, Column, TreeChildren, TreeParent, UpdateDateColumn, CreateDateColumn, Tree, Unique, BaseEntity, JoinColumn, ManyToOne } from 'typeorm';
import { UnknownExtra } from '@graasp/sdk';
import { Member } from '../../members/member';

type ItemExtra = {
  hasThumbnails?: boolean
}

type ItemSettings = {
tags?:string[]
}

@Entity()
@Unique('id', ['id'])
@Tree('materialized-path')
export class Item<Extra extends UnknownExtra=UnknownExtra, Settings extends ItemSettings=ItemSettings> extends BaseEntity {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    length: 100,
  })
  name: string;

  @Column({
    nullable: true,
    length: 100,
  })
  description: string;

  @ManyToOne(() => Member, (member)=>member.id)
  @JoinColumn()
  creator: Member;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column('simple-json', { nullable: false })
  extra: Extra;

  @Column('simple-json', { nullable: false, default:'{}' })
  settings: Extra;

  // return path
  // https://github.com/typeorm/typeorm/issues/4232#issuecomment-585162991

  @TreeChildren()
  children: Item[];

  @TreeParent()
  parent: Item;

}
