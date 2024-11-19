import { BaseEntity, Entity, Index, JoinColumn, OneToOne, PrimaryColumn, Unique } from 'typeorm';

import { UUID } from '@graasp/sdk';

import { Tag } from '../../../tag/Tag.entity';
import { Item } from '../../entities/Item';

@Entity()
@Unique('UQ_item_tag', ['itemId', 'tagId'])
@Index('IDX_item_tag_item', ['itemId'])
export class ItemTag extends BaseEntity {
  @PrimaryColumn({ name: 'tag_id' })
  tagId: UUID;

  @PrimaryColumn({ name: 'item_id' })
  itemId: UUID;

  @OneToOne(() => Tag, (t) => t.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag: Tag;

  @OneToOne(() => Item, (item) => item.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: Item;
}
