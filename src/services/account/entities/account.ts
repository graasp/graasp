import 'reflect-metadata';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  TableInheritance,
  UpdateDateColumn,
} from 'typeorm';

import { AccountType } from '@graasp/sdk';

@Entity()
@TableInheritance({ column: 'type' })
export class Account extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'character varying',
    nullable: false,
    length: 100,
  })
  name: string;

  @Index('IDX_account_type')
  @Column({
    type: 'character varying',
    nullable: false,
    default: AccountType.Individual,
    enum: Object.values(AccountType),
    readonly: true,
  })
  type: `${AccountType}` | AccountType;

  @Column({
    nullable: true,
    type: 'boolean',
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

export function is<T extends Account>(account: Account, type: AccountType): account is T {
  return account.type === type;
}
