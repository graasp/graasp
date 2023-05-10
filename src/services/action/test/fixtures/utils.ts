import { Context } from '@graasp/sdk';

import { Action } from '../../entities/action';

export const checkActionData = (savedAction: Action, args) => {
  const { itemId, extraItemId, item, actionType, view = Context.Unknown, member } = args;
  expect(savedAction.item).toEqual(item);
  expect(savedAction.member).toEqual(member);
  expect(savedAction.type).toEqual(actionType);
  expect(savedAction.view).toEqual(view);
  expect(savedAction.extra!).toEqual({ itemId: itemId ?? extraItemId, memberId: member?.id });
  expect(savedAction.geolocation).toBeFalsy();
};
