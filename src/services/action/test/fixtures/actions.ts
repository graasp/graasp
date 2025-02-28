import { eq } from 'drizzle-orm';

import { ActionFactory, Action as GraaspAction } from '@graasp/sdk';

import { DBConnection, db } from '../../../../drizzle/db';
import {
  ActionInsertRaw,
  ActionRaw,
  ActionWithItem,
  ActionWithItemAndAccount,
  actionsTable,
} from '../../../../drizzle/schema';
import { Account } from '../../../account/entities/account';

type ActionToTest = ActionRaw | ActionWithItem | ActionWithItemAndAccount;
export const saveActions = async (
  actions: Partial<GraaspAction>[],
): Promise<ActionInsertRaw[]> => {
  const data = actions
    .map((d) => ActionFactory(d))
    // HACK: transform the extra to a string since the schema expects it to be a string
    .map((a) => ({
      ...a,
      extra: JSON.stringify(a.extra) as string,
      // HACK: this is because the type in the db is infered as a string and geoiplite could not be imported in the sdk
      geolocation: a.geolocation as string,
    }));
  const res = await db.insert(actionsTable).values(data).returning();
  return res;
};

export const getMemberActions = async (
  db: DBConnection,
  memberId: Account['id'],
): Promise<ActionWithItem[]> => {
  const res = await db.query.actions.findMany({
    where: eq(actionsTable.accountId, memberId),
    with: { item: true },
  });
  return res;
};

export const expectAction = <T extends ActionToTest>(
  action: T,
  correctAction: T,
) => {
  expect(action.extra).toMatchObject(correctAction.extra);
  expect(action.view).toEqual(correctAction.view);
  expect(action.createdAt).toEqual(correctAction.createdAt);
  expect(action.id).toEqual(correctAction.id);
  if ('item' in correctAction) {
    expect(action).toHaveProperty('item');
    if ('item' in action) {
      expect(action.item?.id).toEqual(correctAction.item?.id);
    } else {
      throw new Error(
        'expected item prop to exist on action under test. The property is missing.',
      );
    }
  }
  expect(action.type).toEqual(correctAction.type);
};

export const expectActions = <T extends ActionToTest>(
  actions: T[],
  correctActions: T[],
) => {
  expect(actions).toHaveLength(correctActions.length);

  for (const action of correctActions) {
    const thisAction = actions.find((a) => a.id === action.id);
    if (!thisAction) {
      throw new Error('action should exist');
    }
    expectAction(thisAction, action);
  }
};
