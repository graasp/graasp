import {
  Action,
  ActionBuilder,
  ActionType,
  HttpMethod,
  ItemMembership,
  ItemService,
} from '@graasp/sdk';
import { shouldSaveAForItemAndMember } from 'graasp-plugin-actions';

import { paths } from '../../../util/paths';

export const itemMembershipActionBuilder: (args: {
  payload: unknown;
  itemService: ItemService;
}) => ActionBuilder =
  ({ itemService, payload }) =>
  async ({ request, log, handler }) => {
    // function called each time there is a request in the items in graasp (onResponse hook in graasp)
    // identify and check the correct endpoint of the request
    const { method, url, params } = request;
    // warning: this is really dependent on the url -> how to be more safe and dynamic?
    const paramItemId: string = (params as { id: string })?.id;

    const actions: (Partial<Action> & { actionType: string })[] = [];

    // identify the endpoint with method and url
    switch (method) {
      case HttpMethod.POST:
        switch (true) {
          // todo: refactor since all cases are very similar
          case paths.createItemMembership.test(url):
            // warning: no check over membership !
            const iM = JSON.parse(payload as string) as ItemMembership;
            const item = await itemService.getMatchingPath(iM.itemPath, handler);
            const action = {
              actionType: ActionType.CREATE_ITEM_MEMBERSHIP,
              extra: { itemMembershipId: paramItemId, permission: iM.permission, itemId: item.id },
              itemPath: item.path,
              itemType: item.type,
            };
            if (shouldSaveAForItemAndMember({ item, member: request.member })) {
              actions.push(action);
            }

            break;
        }
        break;
      case HttpMethod.PATCH:
        switch (true) {
          case paths.baseItemMembership.test(url):
            // warning: no check over membership !
            const iM = JSON.parse(payload as string) as ItemMembership;
            const item = await itemService.getMatchingPath(iM.itemPath, handler);
            actions.push({
              actionType: ActionType.UPDATE_ITEM_MEMBERSHIP,
              extra: { itemMembershipId: paramItemId, permission: iM.permission, itemId: item.id },
              itemPath: item.path,
              itemType: item.type,
            });
            // todo: add shouldSaveAForItemAndMember
            break;
        }
        break;
      case HttpMethod.DELETE:
        switch (true) {
          case paths.baseItemMembership.test(url):
            // warning: no check over membership !
            const iM = JSON.parse(payload as string) as ItemMembership;
            const item = await itemService.getMatchingPath(iM.itemPath, handler);
            actions.push({
              actionType: ActionType.DELETE_ITEM_MEMBERSHIP,
              extra: { itemMembershipId: paramItemId, permission: iM.permission, itemId: item.id },
              itemPath: item.path,
              itemType: item.type,
            });
            // todo: add shouldSaveAForItemAndMember
            break;
        }
        break;
      default:
        log.debug('action: request does not match any allowed routes.');
        break;
    }

    return actions;
  };
