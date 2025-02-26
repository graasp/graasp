import { Check, ChildEntity, Column, Unique } from 'typeorm';

import { AccountType, CompleteMember } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { Account } from '../../account/entities/account';

const TYPE = AccountType.Individual;

@ChildEntity(TYPE)
@Unique('UQ_account_email', ['email'])
@Check('CHK_account_email', `"email" IS NOT NULL OR "type" != '${TYPE}'`)
@Check('CHK_account_extra', `"extra" IS NOT NULL OR "type" != '${TYPE}'`)
@Check(
  'CHK_account_enable_save_actions',
  `"enable_save_actions" IS NOT NULL OR "type" != '${TYPE}'`,
)
@Check('CHK_account_is_validated', `"is_validated" IS NOT NULL OR "type" != '${TYPE}'`)
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

  type: AccountType.Individual;

  get lang(): string {
    return (this.extra.lang as string) ?? DEFAULT_LANG;
  }
}
