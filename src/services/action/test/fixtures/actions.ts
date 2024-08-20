import { ActionFactory, Action as GraaspAction } from '@graasp/sdk';

import { Action } from '../../entities/action';

export const saveActions = async (
  rawRepository,
  actions: Partial<GraaspAction>[],
): Promise<Action[]> => {
  const data = actions.map((d) => ActionFactory(d)) as unknown as Action[];

  return rawRepository.save(data);
};

export const getMemberActions = async (rawRepository, memberId): Promise<Action[]> => {
  return rawRepository.findBy({ account: { id: memberId } });
};

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
