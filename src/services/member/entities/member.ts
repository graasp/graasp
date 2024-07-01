import { Check, ChildEntity, Column, Unique } from 'typeorm';

import { CompleteMember, MemberType } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { Account } from './account';

const TYPE = MemberType.Individual;

@ChildEntity(TYPE)
@Unique('email', ['email'])
@Check(`"email" IS NOT NULL OR "type" != '${TYPE}'`)
@Check(`"extra" IS NOT NULL OR "type" != '${TYPE}'`)
@Check(`"enable_save_actions" IS NOT NULL OR "type" != '${TYPE}'`)
@Check(`"is_validated" IS NOT NULL OR "type" != '${TYPE}'`)
export class Member extends Account {
  @Column({
    nullable: false,
    length: 150,
    unique: true,
  })
  email: string;

  @Column('simple-json', { nullable: false, default: '{}' })
  extra: CompleteMember['extra'];

  @Column({
    nullable: true,
    name: 'user_agreements_date',
  })
  userAgreementsDate: Date;

  @Column({
    nullable: false,
    name: 'enable_save_actions',
    default: true,
  })
  enableSaveActions: boolean;

  @Column({
    default: false,
    name: 'is_validated',
    nullable: false,
  })
  isValidated: boolean;

  get lang(): string {
    return (this.extra.lang as string) ?? DEFAULT_LANG;
  }
}

export type Actor = Member | undefined;
