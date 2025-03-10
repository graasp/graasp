import { UnionOfConst } from '@graasp/sdk';

export const CountGroupBy = {
  ActionType: 'actionType',
  ActionLocation: 'actionLocation',
  CreatedDay: 'createdDay',
  CreatedDayOfWeek: 'createdDayOfWeek',
  CreatedTimeOfDay: 'createdTimeOfDay',
  ItemId: 'itemId',
  User: 'user',
} as const;
export type CountGroupByOptions = UnionOfConst<typeof CountGroupBy>;
