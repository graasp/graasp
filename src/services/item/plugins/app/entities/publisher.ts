import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { v4 } from 'uuid';

import { Publisher as GraaspPublisher } from '@graasp/sdk';

@Entity()
@Unique('name', ['name'])
export class Publisher extends BaseEntity implements GraaspPublisher {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @Column({
    unique: true,
    nullable: false,
    length: 250,
  })
  name: string;

  @Column('text', { array: true })
  origins: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
