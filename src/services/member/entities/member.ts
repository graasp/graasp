import { StatusCodes } from 'http-status-codes';
import { Check, ChildEntity, Column, Unique } from 'typeorm';

import { AccountType, CompleteMember } from '@graasp/sdk';
import { DEFAULT_LANG } from '@graasp/translations';

import { Account, is } from '../../account/entities/account';
import { NotMember } from '../error';

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
    type: 'varchar',
  })
  email: string;

  @Column('simple-json', { nullable: false, default: '{}' })
  extra: CompleteMember['extra'];

  @Column({
    nullable: true,
    name: 'user_agreements_date',
    type: 'date',
  })
  userAgreementsDate: Date;

  @Column({
    nullable: false,
    name: 'enable_save_actions',
    default: true,
    type: 'boolean',
  })
  enableSaveActions: boolean;

  @Column({
    default: false,
    name: 'is_validated',
    nullable: false,
    type: 'boolean',
  })
  isValidated: boolean;

  type: AccountType.Individual;

  get lang(): string {
    return (this.extra.lang as string) ?? DEFAULT_LANG;
  }
}

export type Actor = Account | undefined;

export function isMember(account: Account): account is Member {
  return is<Member>(account, TYPE);
}

export function assertIsMember<Err extends Error, Args extends unknown[]>(
  account: Account,
  error?: new (...args: Args) => Err,
  ...args: Args
): asserts account is Member {
  if (!isMember(account)) {
    if (error) {
      throw new error(...args);
    } else {
      const defaultError = new NotMember();
      defaultError.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
      throw defaultError;
    }
  }
}
