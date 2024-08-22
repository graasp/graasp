import { S } from 'fluent-json-schema';

import { AccountType } from '@graasp/sdk';

import { uuid } from '../../schemas/fluent-schema';

export const account = S.object().prop('id', uuid).prop('name', S.string());
export const augmentedAccount = S.object().anyOf([
  S.object()
    .prop('email', S.string().format('email'))
    .prop('type', S.const(AccountType.Individual))
    .extend(account),
  S.object().prop('type', S.const(AccountType.Guest)).extend(account),
]);

export default S.object()
  .id('https://graasp.org/accounts/')
  .definition('account', account)
  .definition('augmentedAccount', augmentedAccount);
