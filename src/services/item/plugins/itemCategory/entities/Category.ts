import { BaseEntity, Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { v4 } from 'uuid';

import { CategoryType, Category as GraaspCategory } from '@graasp/sdk';

@Entity()
@Unique('category-name-type', ['name', 'type'])
export class Category extends BaseEntity implements GraaspCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @Column({
    nullable: false,
    length: 50,
  })
  name: string;

  @Column({
    nullable: false,
  })
  type: CategoryType;
}
