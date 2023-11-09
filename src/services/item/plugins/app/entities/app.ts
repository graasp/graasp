import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { v4 } from 'uuid';

import { Publisher } from './publisher';

export type AppExtra = {
  image?: string;
};

@Entity()
@Unique('app-name', ['name'])
export class App extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  @Column({
    generated: 'uuid',
    unique: true,
    select: false,
    nullable: false,
  })
  key: string = v4();

  @Column({
    nullable: false,
    length: 250,
  })
  name: string;

  @Column({
    nullable: false,
    length: 250,
  })
  description: string;

  @Column({
    nullable: false,
    unique: true,
    length: 250,
  })
  url: string;

  @Column('simple-json', { nullable: false, default: '{}' })
  extra: AppExtra;

  @ManyToOne(() => Publisher, (p) => p.id, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'publisher_id' })
  publisher: Publisher;

  @CreateDateColumn({ name: 'created_at', nullable: false })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', nullable: false })
  updatedAt: Date;
}
