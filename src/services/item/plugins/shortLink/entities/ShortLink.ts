import {
  BaseEntity,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  EntityManager,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { ShortLinkPlatform, UUID, UnionOfConst } from '@graasp/sdk';

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

  // This column is needed to return the itemId only without doing a join (for mobile for example).
  // The select is set to false, to avoid to return the itemId when the item is returned.
  @Column({ name: 'item_id', select: false })
  itemId: UUID;

  /**
   * This method return all the columns of the entity.
   * It is useful when you want to select all columns without having to list their manually.
   * @returns all the columns of this entity, hidden columns are also include.
   */
  static getAllColumns(manager: EntityManager) {
    return manager.connection
      .getMetadata(ShortLink)
      .columns.map((x) => x.propertyName as keyof ShortLink);
  }
}
