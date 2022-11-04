import { ItemService } from '@graasp/sdk';
import { ActionHandlerInput, BaseAction, getBaseAction } from 'graasp-plugin-actions';

import { CLIENT_HOSTS } from '../../../util/config';
import { ACTION_TYPES, METHODS, paths } from '../constants/constants';

export const itemActionHandler = async (
  dbService: ItemService,
  actionInput: ActionHandlerInput,
): Promise<BaseAction[]> => {
  const { request, log, dbHandler } = actionInput;
  // function called each time there is a request in the items in graasp (onResponse hook in graasp)
  // identify and check the correct endpoint of the request
  const { method, url, query, params, member } = request;
  // warning: this is really dependent on the url -> how to be more safe and dynamic?
  const paramItemId: string = (params as { id: string })?.id;
  let queryItemIds = (query as { id })?.id;
  if (!Array.isArray(queryItemIds)) {
    queryItemIds = [queryItemIds];
  }

  const baseAction = getBaseAction(request, CLIENT_HOSTS);

  const actionsToSave = [];
  const actionBase = {
    ...baseAction,
    extra: { memberId: member.id },
  };

  // identify the endpoint with method and url
  // call createActionTask or createActionTaskMultipleItems to save the corresponding action
  switch (method) {
    case METHODS.GET:
      switch (true) {
        case paths.childrenItem.test(url):
          actionsToSave.push({
            ...actionBase,
            actionType: ACTION_TYPES.GET_CHILDREN,
            extra: { ...actionBase.extra, itemId: paramItemId },
          });
          break;
        case paths.baseItem.test(url):
          actionsToSave.push({
            ...actionBase,
            actionType: ACTION_TYPES.GET,
            extra: { ...actionBase.extra, itemId: paramItemId },
          });
          break;
      }
      break;
    case METHODS.POST:
      switch (true) {
        case paths.copyItem.test(url):
          const copyItemParentId = (request.body as { parentId: string })?.parentId;
          actionsToSave.push({
            ...actionBase,
            actionType: ACTION_TYPES.COPY,
            extra: { ...actionBase.extra, itemId: paramItemId, parentId: copyItemParentId },
          });
          break;
        case paths.copyItems.test(url):
          const copyItemsParentId = (request.body as { parentId: string })?.parentId;
          queryItemIds.forEach((id) => {
            actionsToSave.push({
              ...actionBase,
              actionType: ACTION_TYPES.COPY,
              extra: { ...actionBase.extra, itemId: id, parentId: copyItemsParentId },
            });
          });
          break;
        case paths.moveItem.test(url):
          const moveItemParentId = (request.body as { parentId: string })?.parentId;
          actionsToSave.push({
            ...actionBase,
            actionType: ACTION_TYPES.MOVE,
            extra: { ...actionBase.extra, itemId: paramItemId, parentId: moveItemParentId },
          });
          break;
        case paths.moveItems.test(url):
          const moveItemsParentId = (request.body as { parentId: string })?.parentId;
          queryItemIds.forEach((id) => {
            actionsToSave.push({
              ...actionBase,
              actionType: ACTION_TYPES.MOVE,
              extra: { ...actionBase.extra, itemId: id, parentId: moveItemsParentId },
            });
          });
          break;
      }
      break;
    case METHODS.PATCH:
      switch (true) {
        case paths.baseItem.test(url):
          actionsToSave.push({
            ...actionBase,
            itemId: paramItemId,
            actionType: ACTION_TYPES.UPDATE,
            extra: { ...actionBase.extra, itemId: paramItemId },
          });
          break;
        case paths.multipleItems.test(url):
          actionsToSave.push(
            ...queryItemIds.map((itemId) => ({
              ...actionBase,
              itemId: itemId,
              actionType: ACTION_TYPES.UPDATE,
              extra: { ...actionBase.extra, itemId },
            })),
          );
          break;
      }
      break;
    default:
      log.debug('action: request does not match any allowed routes.');
      break;
  }

  // get item specific data to put in actions
  const actions = await Promise.all(
    actionsToSave.map(async (action) => {
      // warning: no check over membership !
      const item = await dbService.get(action.extra.itemId, dbHandler);
      // add item type and path
      return new BaseAction({ ...action, itemType: item.type, itemPath: item.path });
    }),
  );

  return actions;
};
