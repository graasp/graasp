import { Repository } from 'typeorm';

import { ActionFactory, Action as GraaspAction } from '@graasp/sdk';

import { Account } from '../../../account/entities/account';
import { Action } from '../../entities/action';

export const saveActions = async (
  rawRepository: Repository<Action>,
  actions: Partial<GraaspAction>[],
): Promise<Action[]> => {
  const data = actions.map((d) => ActionFactory(d)) as unknown as Action[];

  return rawRepository.save(data);
};

export const getMemberActions = async (
  rawRepository: Repository<Action>,
  memberId: Account['id'],
): Promise<Action[]> => {
  return rawRepository.findBy({ account: { id: memberId } });
};

export const expectAction = (action: Action, correctAction: Action) => {
  expect(action.extra).toMatchObject(correctAction.extra);
  expect(action.view).toEqual(correctAction.view);
  expect(action.createdAt).toEqual(correctAction.createdAt);
  expect(action.id).toEqual(correctAction.id);
  expect(action.item!.id).toEqual(correctAction.item!.id);
  expect(action.type).toEqual(correctAction.type);
};

export const expectActions = (actions: Action[], correctActions: Action[]) => {
  expect(actions).toHaveLength(correctActions.length);

  for (const action of correctActions) {
    const thisAction = actions.find((a) => a.id === action.id);
    if (!thisAction) {
      throw new Error('action should exist');
    }
    expectAction(thisAction, action);
  }
};
