import { ChildEntity, Column, JoinColumn, ManyToOne } from 'typeorm';

import { CompleteMember, MemberType } from '@graasp/sdk';

import { Account } from '../../member/entities/account';
import { ItemLoginSchema } from './itemLoginSchema';

@ChildEntity(MemberType.Guest)
export class Guest extends Account {
  @ManyToOne(() => ItemLoginSchema, (itemLoginSchema) => itemLoginSchema.id, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'item_login_schema_id' })
  itemLoginSchema: ItemLoginSchema;

  @Column('simple-json', { nullable: false, default: '{"lang":"de"}' })
  extra: CompleteMember['extra'];
}
