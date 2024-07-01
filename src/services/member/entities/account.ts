import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';

import { MemberType } from '@graasp/sdk';

@Entity()
@TableInheritance({ column: 'type' })
export class Account extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  @Column({
    nullable: false,
    length: 100,
  })
  name: string;

  @Column({
    nullable: false,
    default: MemberType.Individual,
    enum: Object.values(MemberType),
    readonly: true,
  })
  readonly type: `${MemberType}` | MemberType;

  @Column({
    nullable: true,
    name: 'last_authenticated_at',
  })
  lastAuthenticatedAt: Date;

  @CreateDateColumn({
    update: false,
    name: 'created_at',
    nullable: false,
  })
  createdAt: Date;

  @UpdateDateColumn({
    update: false,
    name: 'updated_at',
    nullable: false,
  })
  updatedAt: Date;
}
