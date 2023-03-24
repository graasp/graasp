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
export class App extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string = v4();

  // TODO
  @Column({
    generated: 'uuid',
    unique: true,
    select: false,
  })
  key: string = v4();

  @Column({
    nullable: false,
  })
  name: string;

  @Column({
    nullable: true,
  })
  description: string;

  @Column({
    nullable: false,
    unique: true,
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
