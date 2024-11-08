import { BaseEntity, Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { v4 } from 'uuid';

import { TagCategory } from '@graasp/sdk';

@Entity()
@Unique('UQ_tag_name_category', ['name', 'category'])
export class Tag extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: Object.values(TagCategory),
  })
  category: TagCategory;
}
