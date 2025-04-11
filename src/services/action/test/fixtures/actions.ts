import { eq } from 'drizzle-orm';

import { DBConnection } from '../../../../drizzle/db';
import { actionsTable } from '../../../../drizzle/schema';
import {
  Account,
  ActionRaw,
  ActionWithItem,
  ActionWithItemAndAccount,
} from '../../../../drizzle/types';

type ActionToTest = ActionRaw | ActionWithItem | ActionWithItemAndAccount;
// export const saveActions = async (actions: Partial<GraaspAction>[]): Promise<ActionInsertDTO[]> => {
//   const data = actions
//     .map((d) => ActionFactory(d))
//     // HACK: transform the extra to a string since the schema expects it to be a string
//     .map((a) => ({
//       ...a,
//       extra: JSON.stringify(a.extra) as string,
//       // HACK: this is because the type in the db is infered as a string and geoiplite could not be imported in the sdk
//       geolocation: a.geolocation as string,
//     }));
//   const res = await db.insert(actionsTable).values(data).returning();
//   return res;
// };

export const getMemberActions = async (
  dbConnection: DBConnection,
  memberId: Account['id'],
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
