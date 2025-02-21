import { v4 as uuidv4 } from 'uuid';

import { ActionTriggers, Context } from '@graasp/sdk';

import { Account } from '../../../../../account/entities/account';
import { Action } from '../../../../../action/entities/action';
import { ActionRepository } from '../../../../../action/repositories/action.repository';
import { Member } from '../../../../../member/entities/member';
import { Item } from '../../../../entities/Item';
import { ItemActionType } from '../../utils';

export const getDummyAction = (
  view: Context,
  type: ItemActionType | ActionTriggers,
  createdAt: Date,
  account: Account,
  item: Item,
): Action => {
  const buildId = uuidv4();
  return {
    id: buildId,
    view: view,
    type: type,
    geolocation: {},
    createdAt: createdAt,
    account,
    item: item,
    extra: {},
  } as unknown as Action;
};

const buildActions = (item: Item, member: Member[]) => {
  const actions: Action[] = [
    getDummyAction(
      Context.Builder,
      ItemActionType.Create,
      new Date('2023-05-20T08:46:52.939Z'),
      member[0],
      item,
    ),
    getDummyAction(
      Context.Builder,
      ItemActionType.Update,
      new Date('2023-05-21T08:46:52.939Z'),
      member[0],
      item,
    ),
    getDummyAction(
      Context.Builder,
      ItemActionType.Update,
      new Date('2023-05-21T08:46:52.939Z'),
      member[0],
      item,
    ),
    getDummyAction(
      Context.Builder,
      ItemActionType.Update,
      new Date('2023-05-21T08:46:52.939Z'),
      member[1],
      item,
    ),
    getDummyAction(
      Context.Builder,
      ItemActionType.Update,
      new Date('2023-05-21T03:46:52.939Z'),
      member[2],
      item,
    ),
    getDummyAction(
      Context.Player,
      ItemActionType.Update,
      new Date('2023-05-21T03:46:52.939Z'),
      member[2],
      item,
    ),
    getDummyAction(
      Context.Builder,
      ActionTriggers.CollectionView,
      new Date('2023-05-21T03:46:52.939Z'),
      member[2],
      item,
    ),
  ];
  return actions;
};

export const saveActions = async (item: Item, member: Member[]) => {
  const actions: Action[] = buildActions(item, member);

  await new ActionRepository().postMany(actions);
  return actions;
};
