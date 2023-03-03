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

@Entity()
@Unique('id', ['id'])
export class Publisher extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @Column({
    unique: true,
    nullable: false,
  })
  name: string;

  @Column('text', { array: true })
  origins: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
