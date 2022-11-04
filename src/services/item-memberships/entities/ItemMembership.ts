import { Entity, PrimaryGeneratedColumn, Column,UpdateDateColumn, CreateDateColumn,  Unique, BaseEntity, JoinColumn, ManyToOne } from 'typeorm';
import { PermissionLevel,  } from '@graasp/sdk';
import { Member } from '../../members/member';
import { Item } from '../../items/entities/Item';

@Entity()
@Unique('item-member', ['item', 'member'])
export class ItemMembership extends BaseEntity {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    length: 100,
  })
  permission: PermissionLevel;

  @ManyToOne(() => Member, (member)=>member.id)
  @JoinColumn()
  creator: Member;

  @ManyToOne(() => Member, (member)=>member.id)
  @JoinColumn()
  member: Member;

  // use path ???
  @ManyToOne(() => Item, (item)=>item.id)
  @JoinColumn()
  item: Item;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

}
