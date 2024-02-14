import { v4 as uuidv4 } from 'uuid';

import { Context } from '@graasp/sdk';

import { Action } from '../../entities/action';

export const buildAction = (data: Partial<Action>): Partial<Action> => ({
  id: uuidv4(),
  view: Context.Builder,
  type: 'type',
  extra: {},
  createdAt: new Date('2021-03-29T08:46:52.939Z'),
  ...data,
});

export const expectAction = (action, correctAction) => {
  expect(action.extra).toMatchObject(correctAction.extra);
  expect(action.view).toEqual(correctAction.view);
  expect(action.created_at).toEqual(correctAction.created_at);
  expect(action.id).toEqual(correctAction.id);
  expect(action.item.id).toEqual(correctAction.item.id);
  expect(action.type).toEqual(correctAction.type);
};

export const expectActions = (actions, correctActions) => {
  expect(actions).toHaveLength(correctActions.length);

  for (const action of correctActions) {
    const thisAction = actions.find((a) => a.id === action.id);
    if (!thisAction) {
      throw new Error('action should exist');
    }
    expectAction(thisAction, action);
  }
};
