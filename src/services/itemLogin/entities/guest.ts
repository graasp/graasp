import { ChildEntity, Column, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { AccountType, CompleteMember } from '@graasp/sdk';

import { Account, is } from '../../account/entities/account';
import { ItemLoginSchema } from './itemLoginSchema';

const TYPE = AccountType.Guest;

@ChildEntity(TYPE)
@Unique('UQ_account_name_item_login_schema_id', ['name', 'itemLoginSchema']) // We should have only 1 <username> in 1 <item>. But could have n <usernames> in n <items>.
export class Guest extends Account {
  @ManyToOne(() => ItemLoginSchema, (itemLoginSchema) => itemLoginSchema.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'item_login_schema_id',
    foreignKeyConstraintName: 'FK_account_item_login_schema_id',
  })
  itemLoginSchema: ItemLoginSchema;

  @Column('simple-json', { nullable: false, default: '{}' })
  extra: CompleteMember['extra'];

  type: AccountType.Guest;
}

export function isGuest(account: Account): account is Guest {
  return is<Guest>(account, TYPE);
}
