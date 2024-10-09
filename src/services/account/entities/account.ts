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
    nullable: false,
    length: 100,
    type: 'varchar',
  })
  name: string;

  @Index('IDX_account_type')
  @Column({
    nullable: false,
    default: AccountType.Individual,
    enum: Object.values(AccountType),
    readonly: true,
    type: 'varchar',
  })
  type: `${AccountType}` | AccountType;

  @Column({
    nullable: true,
    name: 'last_authenticated_at',
    type: 'date',
  })
  lastAuthenticatedAt: Date;

  @CreateDateColumn({
    update: false,
    name: 'created_at',
    nullable: false,
    type: 'date',
  })
  createdAt: Date;

  @UpdateDateColumn({
    update: false,
    name: 'updated_at',
    nullable: false,
    type: 'date',
  })
  updatedAt: Date;
}

export function is<T extends Account>(account: Account, type: AccountType): account is T {
  return account.type === type;
}
