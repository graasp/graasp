// import { GRAASP_ACTOR, VIEW_UNKNOWN_NAME } from '../../../../utils/config';
// import { Action } from '../../entities/action';

// export const checkActionData = (savedAction:Action, args) => {
//   const {
//     itemId,
//     extraItemId,
//     itemType,
//     actionType,
//     view = VIEW_UNKNOWN_NAME,
//     memberId = GRAASP_ACTOR.id,
//   } = args;
//   expect(savedAction.itemType).toEqual(itemType);
//   expect(savedAction.memberId).toEqual(memberId);
//   expect(savedAction.actionType).toEqual(actionType);
//   expect(savedAction.view).toEqual(view);
//   expect(savedAction.extra.itemId).toEqual(itemId ?? extraItemId);
//   expect(savedAction.extra.memberId).toEqual(memberId);
//   expect(savedAction.geolocation).toBeFalsy();
// };
