import { eq } from 'drizzle-orm';
import { expect } from 'vitest';

import { type DBConnection } from '../../../../drizzle/db';
import { actionsTable } from '../../../../drizzle/schema';
import type {
  ActionRaw,
  ActionWithItem,
  ActionWithItemAndAccount,
  MinimalAccount,
} from '../../../../drizzle/types';

type ActionToTest = ActionRaw | ActionWithItem | ActionWithItemAndAccount;

export const getMemberActions = async (
  dbConnection: DBConnection,
  memberId: MinimalAccount['id'],
): Promise<ActionWithItem[]> => {
  const res = await dbConnection.query.actionsTable.findMany({
    where: eq(actionsTable.accountId, memberId),
    with: { item: true },
  });
  return res;
};

export const expectAction = <T extends ActionToTest>(action: T, correctAction: T) => {
  expect(action.extra).toMatchObject(correctAction.extra);
  expect(action.view).toEqual(correctAction.view);
  expect(action.createdAt).toEqual(correctAction.createdAt);
  expect(action.id).toEqual(correctAction.id);
  if ('item' in correctAction) {
    expect(action).toHaveProperty('item');
    if ('item' in action) {
      expect(action.item?.id).toEqual(correctAction.item?.id);
    } else {
      throw new Error('expected item prop to exist on action under test. The property is missing.');
    }
  }
  expect(action.type).toEqual(correctAction.type);
};

export const expectActions = <T extends ActionToTest>(actions: T[], correctActions: T[]) => {
  expect(actions).toHaveLength(correctActions.length);

  for (const action of correctActions) {
    const thisAction = actions.find((a) => a.id === action.id);
    if (!thisAction) {
      throw new Error('action should exist');
    }
    expectAction(thisAction, action);
  }
};
