import { Action, ActionBuilder, ActionType, HttpMethod, Item, ItemService } from '@graasp/sdk';

import { paths } from '../../../util/paths';

export const itemActionBuilder: (args: {
  itemService: ItemService;
  payload?: unknown;
}) => ActionBuilder =
  ({ itemService, payload }) =>
  async ({ request, log, handler }) => {
    // function called each time there is a request in the items in graasp (onResponse hook in graasp)
    // identify and check the correct endpoint of the request
    const { method, url, query, params, body: rawBody } = request;
    const body = rawBody as object;
    // warning: this is really dependent on the url -> how to be more safe and dynamic?
    const paramItemId: string = (params as { id: string })?.id;
    let queryItemIds = (query as { id })?.id;
    if (!Array.isArray(queryItemIds)) {
      queryItemIds = [queryItemIds];
    }

    const actions: (Partial<Action> & { actionType: string })[] = [];

    // todo: add create and delete item

    // identify the endpoint with method and url
    switch (method) {
      case HttpMethod.POST:
        switch (true) {
          case paths.createItem.test(url):
          case paths.createItemWithParent.test(url): {
            const parentId = (request.body as { parentId: string })?.parentId;
            const itemId = (JSON.parse(payload as string) as Item).id;
            const item = await itemService.get(itemId, handler);
            actions.push({
              actionType: ActionType.CREATE_ITEM,
              extra: { itemId, parentId: parentId },
              itemType: item.type,
              itemPath: item.path,
            });
            // todo: should save
            break;
          }
          case paths.copyItem.test(url):
            const copyItemParentId = (request.body as { parentId: string })?.parentId;
            const itemId = paramItemId;
            // warning: no check over membership !
            const item = await itemService.get(itemId, handler);
            actions.push({
              actionType: ActionType.COPY_ITEM,
              extra: { itemId, parentId: copyItemParentId },
              itemType: item.type,
              itemPath: item.path,
            });
            // todo: add should save

            break;
          case paths.copyItems.test(url): {
            const copyItemsParentId = (request.body as { parentId: string })?.parentId;
            const items = await itemService.getMany(queryItemIds, handler);
            queryItemIds.forEach((id) => {
              const item = items.find(({ id: thisId }) => id === thisId);
              // warning: no check over membership !
              actions.push({
                actionType: ActionType.COPY_ITEM,
                extra: { itemId: id, parentId: copyItemsParentId },
                itemType: item?.type,
                itemPath: item?.path,
              });
            });
            // todo: add should save

            break;
          }
          case paths.moveItem.test(url): {
            const moveItemParentId = (request.body as { parentId: string })?.parentId;
            // warning: no check over membership !
            const item = await itemService.get(paramItemId, handler);
            actions.push({
              actionType: ActionType.MOVE_ITEM,
              extra: { itemId: paramItemId, parentId: moveItemParentId },
              itemType: item?.type,
              itemPath: item?.path,
            });
            // todo: add should save

            break;
          }
          case paths.moveItems.test(url): {
            const moveItemsParentId = (request.body as { parentId: string })?.parentId;
            const items = await itemService.getMany(queryItemIds, handler);
            queryItemIds.forEach((id) => {
              const item = items.find(({ id: thisId }) => id === thisId);
              // warning: no check over membership !
              actions.push({
                actionType: ActionType.MOVE_ITEM,
                extra: { itemId: id, parentId: moveItemsParentId },
                itemType: item?.type,
                itemPath: item?.path,
              });
            });
            // todo: add should save

            break;
          }
        }
        break;
      case HttpMethod.PATCH:
        switch (true) {
          case paths.baseItem.test(url):
            // warning: no check over membership !
            const item = await itemService.get(paramItemId, handler);
            actions.push({
              actionType: ActionType.UPDATE_ITEM,
              extra: { itemId: paramItemId, ...body },
              itemType: item?.type,
              itemPath: item?.path,
            });
            // todo: add should save

            break;
          case paths.multipleItems.test(url): {
            const items = await itemService.getMany(queryItemIds, handler);
            queryItemIds.map((itemId) => {
              const item = items.find(({ id }) => itemId === id);

              actions.push({
                actionType: ActionType.UPDATE_ITEM,
                extra: { itemId },
                itemType: item?.type,
                itemPath: item?.path,
              });
            });
            // todo: add should save

            break;
          }
        }
        break;
      case HttpMethod.DELETE:
        switch (true) {
          case paths.deleteItem.test(url):
            // warning: no check over membership !
            const item = JSON.parse(payload as string) as Item;
            actions.push({
              actionType: ActionType.DELETE_ITEM,
              extra: { itemId: paramItemId, itemPath: item?.path },
              itemType: item?.type,
              // since the item does not exist anymore, we cannot set item path
            });
            // todo: add should save

            break;
          case paths.deleteItems.test(url): {
            const items = JSON.parse(payload as string);
            queryItemIds.map((itemId) => {
              const item = items.find(({ id }) => itemId === id);

              actions.push({
                actionType: ActionType.DELETE_ITEM,
                extra: { itemId, itemPath: item?.path },
                itemType: item?.type,
                // since the item does not exist anymore, we cannot set item path
              });
            });
            // todo: add should save
            break;
          }
        }
        break;
      default:
        log.debug('action: request does not match any allowed routes.');
        break;
    }

    return actions;
  };
