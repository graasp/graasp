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
