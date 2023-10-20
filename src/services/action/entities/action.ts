import geoip from 'geoip-lite';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Context, Action as GraaspAction } from '@graasp/sdk';

import { Item } from '../../item/entities/Item';
import { Member } from '../../member/entities/member';

@Entity()
@Index('IDX_gist_action_path', { synchronize: false })
export class Action extends BaseEntity implements GraaspAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Member, (member) => member.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'member_id' })
  @Index()
  member?: Member | null;

  /**
   * action can be related to a behavior not related to an item
   */
  @ManyToOne(() => Item, (item) => item.path, {
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ referencedColumnName: 'path', name: 'item_path' })
  item?: Item | null;

  @Column({
    nullable: false,
    enum: Object.values(Context),
  })
  view: Context | 'Unknown';

  @Column({
    nullable: false,
  })
  type: string;

  @Column('simple-json', { nullable: false })
  extra: { [key: string]: unknown };

  @Column('simple-json', { nullable: true, default: null })
  geolocation?: geoip.Lookup;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
