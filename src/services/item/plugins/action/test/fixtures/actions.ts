import { v4 as uuidv4 } from 'uuid';

import { Context } from '@graasp/sdk';

import { Action } from '../../../../../action/entities/action';
import { ActionRepository } from '../../../../../action/repositories/action';
import { Member } from '../../../../../member/entities/member';
import { Item } from '../../../../entities/Item';
import { ItemActionType } from '../../utils';

const getDummyAction = (
  view: Context,
  type: ItemActionType,
  createdAt: Date,
  member: Member,
  item: Item,
): Action => {
  const buildId = uuidv4();
  return {
    id: buildId,
    view: view,
    type: type,
    geolocation: {},
    createdAt: createdAt,
    member: member,
    item: item,
    extra: {},
  } as unknown as Action;
};

const buildActions = (item: Item, member: Member[]) => {
  const actions: Action[] = [];
  let dummyAction;

  dummyAction = getDummyAction(
    Context.Builder,
    ItemActionType.Create,
    new Date('2023-05-20T08:46:52.939Z'),
    member[0],
    item,
  );
  actions.push(dummyAction);

  dummyAction = getDummyAction(
    Context.Builder,
    ItemActionType.Update,
    new Date('2023-05-21T08:46:52.939Z'),
    member[0],
    item,
  );
  actions.push(dummyAction);

  dummyAction = getDummyAction(
    Context.Builder,
    ItemActionType.Update,
    new Date('2023-05-21T08:46:52.939Z'),
    member[0],
    item,
  );
  actions.push(dummyAction);

  dummyAction = getDummyAction(
    Context.Builder,
    ItemActionType.Update,
    new Date('2023-05-21T08:46:52.939Z'),
    member[1],
    item,
  );
  actions.push(dummyAction);

  dummyAction = getDummyAction(
    Context.Builder,
    ItemActionType.Update,
    new Date('2023-05-21T03:46:52.939Z'),
    member[2],
    item,
  );
  actions.push(dummyAction);

  return actions;
};

export const saveActions = async (item: Item, member: Member[]) => {
  const actions: Action[] = buildActions(item, member);

  await ActionRepository.postMany(actions);
  return actions;
};
