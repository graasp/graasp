import { v4 as uuidv4 } from 'uuid';

import { ActionTriggers, Context } from '@graasp/sdk';

import { db } from '../../../../../../drizzle/db';
import { ActionWithItemAndAccount, Item } from '../../../../../../drizzle/schema';
import { Account } from '../../../../../account/entities/account';
import { ActionRepository } from '../../../../../action/action.repository';
import { Member } from '../../../../../member/entities/member';
import { ItemActionType } from '../../utils';

export const getDummyAction = (
  view: Context,
  type: ItemActionType | ActionTriggers,
  createdAt: Date,
  account: Account,
  item: Item,
): ActionWithItemAndAccount => {
  const buildId = uuidv4();
  return {
    id: buildId,
    view: view,
    type: type,
    geolocation: '',
    createdAt: createdAt.toISOString(),
    account,
    item: item,
    extra: JSON.stringify({}),
  };
};

const buildActions = (item: Item, member: Member[]) => {
  const actions: ActionWithItemAndAccount[] = [
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
  const actions: ActionWithItemAndAccount[] = buildActions(item, member);

  await new ActionRepository().postMany(db, actions);
  return actions;
};
