import {
  BaseEntity,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { ShortLinkPlatform, UnionOfConst } from '@graasp/sdk';

import { Item } from '../../../../item/entities/Item';

@Entity()
@Unique(['item', 'platform']) // add constraint to have only one shortlink per context per item
@Check(`LENGTH(alias) >= 6 AND LENGTH(alias) <= 255 AND alias ~ '^[a-zA-Z0-9-]*$'`)
export class ShortLink extends BaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  alias: string;

  @Column({ type: 'enum', enum: Object.values(ShortLinkPlatform), nullable: false })
  platform: UnionOfConst<typeof ShortLinkPlatform>;

  @CreateDateColumn({ type: 'timestamp', default: () => 'NOW()' })
  createdAt: Date;

  @ManyToOne(() => Item, (item) => item.id, {
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
    nullable: false,
  })
  @Index()
  @JoinColumn({ referencedColumnName: 'id', name: 'item_id' })
  item: Item;
}
