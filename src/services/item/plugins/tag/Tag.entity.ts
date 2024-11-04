import { BaseEntity, Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { v4 } from 'uuid';

import { TagCategory } from '@graasp/sdk';

@Entity()
@Unique('tag-name-category', ['name', 'category'])
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
