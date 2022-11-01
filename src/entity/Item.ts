import { Entity, PrimaryGeneratedColumn, Column, TreeChildren, TreeParent, UpdateDateColumn, CreateDateColumn, Tree, Unique, BaseEntity } from 'typeorm';
import { ObjectType, Field } from 'type-graphql';

type ItemExtra = {
  hasThumbnails?: boolean
}

@Entity()
@ObjectType() // graphql
@Unique('id', ['id'])
@Tree('materialized-path')
export class Item extends BaseEntity {

  @Field() // graphql
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Field()
  @Column({
    select:false,
    length: 100,
  })
  name: string;

  @Field()
  @Column({
    nullable: true,
    length: 100,
  })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // return path
  // https://github.com/typeorm/typeorm/issues/4232#issuecomment-585162991

  @TreeChildren()
  children: Item[];

  @TreeParent()
  parent: Item;

}
