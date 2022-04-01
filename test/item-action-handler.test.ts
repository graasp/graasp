import { itemActionHandler } from '../src/services/items/handler/item-action-handler';
import { getDummyItem } from './fixtures/items';
import { CLIENT_HOSTS, GRAASP_ACTOR } from '../src/util/config';
import { FastifyLoggerInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DatabaseTransactionHandler, ItemService } from '../src';
import { checkActionData, HTTP_METHODS } from './fixtures/utils';
import { ACTION_TYPES } from '../src/services/items/constants/constants';
import qs from 'qs';
import { v4 } from 'uuid';

// mock itemService get method for single item
const getItemService = (item) =>
  ({
    get: jest.fn(async () => item),
  } as unknown as ItemService);

// mock itemService get method for multiple items
const getMultipleItemService = (items) =>
  ({
    get: jest.fn(async (id) => items.find(({ id: thisId }) => thisId === id)),
  } as unknown as ItemService);

// build multiple items url with endpoint (needs to start with '/')
const buildMultipleItemsUrl = (endpoint, id?) =>
  `/items${endpoint}${qs.stringify({ id }, { arrayFormat: 'repeat', addQueryPrefix: true })}`;

// dbHandler can be null as we do not use it with the mock itemService
const dbTransactionHandler = null as unknown as DatabaseTransactionHandler;
const reply = null as unknown as FastifyReply;
const log = { debug: () => null } as unknown as FastifyLoggerInstance;
const item = getDummyItem();
const itemService = getItemService(item);
const BUILDER_CLIENT_HOST = CLIENT_HOSTS[0];
const request = {
  url: `/items/${item.id}`,
  method: 'GET',
  member: GRAASP_ACTOR,
  params: {},
  query: {},
  ip: '',
  headers: {},
} as unknown as FastifyRequest;

describe('Create Action Task', () => {
  it('check geolocation and view properties', async () => {
    // create a request with valid ip and headers to test view and geolocation
    const geolocationAndViewRequest = {
      ...request,
      ip: '192.158.1.38',
      headers: {
        origin: `https://${BUILDER_CLIENT_HOST.hostname}`,
      },
    };

    const actions = await itemActionHandler(itemService, {
      request: geolocationAndViewRequest,
      reply,
      log,
      dbHandler: dbTransactionHandler,
    });
    expect(actions[0].geolocation).toBeTruthy();
    expect(actions[0].view).toEqual(BUILDER_CLIENT_HOST.name);
  });

  it('returns empty actions array if request does not match any path', async () => {
    const invalidUrlRequest = {
      ...request,
      method: HTTP_METHODS.GET,
      url: '/hello',
    };
    const itemService = getItemService(item);

    jest.spyOn(itemService, 'get');
    const actions = await itemActionHandler(itemService, {
      request: invalidUrlRequest,
      reply,
      log,
      dbHandler: dbTransactionHandler,
    });
    // actions array should be empty
    expect(actions).toHaveLength(0);
  });

  it('GET an item', async () => {
    const validGetRequest = {
      ...request,
      method: HTTP_METHODS.GET,
      url: `/items/${item.id}`,
      params: {
        ...(request.params as object),
        id: item.id,
      },
    };

    const savedActions = await itemActionHandler(itemService, {
      request: validGetRequest,
      reply,
      log,
      dbHandler: dbTransactionHandler,
    });
    expect(savedActions).not.toHaveLength(0);
    checkActionData(savedActions[0], {
      itemId: item.id,
      itemType: item.type,
      actionType: ACTION_TYPES.GET,
    });
  });

  it('GET children', async () => {
    const validGetChildrenRequest = {
      ...request,
      method: HTTP_METHODS.GET,
      url: `/items/${item.id}/children`,
      params: {
        ...(request.params as object),
        id: item.id,
      },
    };

    const savedActions = await itemActionHandler(itemService, {
      request: validGetChildrenRequest,
      reply,
      log,
      dbHandler: dbTransactionHandler,
    });
    // should return array with an action
    expect(savedActions).not.toHaveLength(0);
    checkActionData(savedActions[0], {
      itemId: item.id,
      itemType: item.type,
      actionType: ACTION_TYPES.GET_CHILDREN,
    });
  });

  it('POST copy item', async () => {
    const validPostCopyRequest = {
      ...request,
      method: HTTP_METHODS.POST,
      url: `/items/${item.id}/copy`,
      params: {
        ...(request.params as object),
        id: item.id,
      },
    };

    const savedActions = await itemActionHandler(itemService, {
      request: validPostCopyRequest,
      reply,
      log,
      dbHandler: dbTransactionHandler,
    });
    // should return array with an action
    expect(savedActions).not.toHaveLength(0);
    checkActionData(savedActions[0], {
      itemId: item.id,
      itemType: item.type,
      actionType: ACTION_TYPES.COPY,
    });
  });

  it('POST copy one item using copy multiple items endpoint', async () => {
    const ids = [item.id];
    const validPostCopyOneUsingMultipleRequest = {
      ...request,
      method: HTTP_METHODS.POST,
      url: buildMultipleItemsUrl('/copy', ids),
      params: {
        ...(request.params as object),
        id: ids,
      },
      query: {
        id: ids,
      },
    };

    const savedActions = await itemActionHandler(itemService, {
      request: validPostCopyOneUsingMultipleRequest,
      reply,
      log,
      dbHandler: dbTransactionHandler,
    });
    // should return array with an action
    expect(savedActions).not.toHaveLength(0);
    checkActionData(savedActions[0], {
      itemId: item.id,
      itemType: item.type,
      actionType: ACTION_TYPES.COPY,
    });
  });

  it('POST copy multiple items', async () => {
    const items = [getDummyItem(), getDummyItem()];
    const ids = items.map((i) => i.id);

    const validPostCopyMultipleRequest = {
      ...request,
      method: HTTP_METHODS.POST,
      url: buildMultipleItemsUrl('/copy', ids),
      params: {
        ...(request.params as object),
        id: ids,
      },
      query: {
        id: ids,
      },
    };

    const itemService = getMultipleItemService(items);

    const savedActions = await itemActionHandler(itemService, {
      request: validPostCopyMultipleRequest,
      reply,
      log,
      dbHandler: dbTransactionHandler,
    });

    expect(savedActions.length).toEqual(items.length);
    items.forEach((item, idx) => {
      checkActionData(savedActions[idx], {
        itemId: item.id,
        itemType: item.type,
        actionType: ACTION_TYPES.COPY,
      });
    });
  });

  it('POST move item', async () => {
    const parentId = v4();
    const validPostMoveRequest = {
      ...request,
      method: HTTP_METHODS.POST,
      url: `/items/${item.id}/move`,
      params: {
        ...(request.params as object),
        id: item.id,
      },
      body: {
        parentId,
      },
    };

    const savedActions = await itemActionHandler(itemService, {
      request: validPostMoveRequest,
      reply,
      log,
      dbHandler: dbTransactionHandler,
    });
    // should return array with an action
    expect(savedActions).not.toHaveLength(0);
    expect(savedActions[0].extra.parentId).toEqual(parentId);
    checkActionData(savedActions[0], {
      itemId: item.id,
      itemType: item.type,
      actionType: ACTION_TYPES.MOVE,
    });
  });

  it('POST move one item using copy multiple items endpoint', async () => {
    const items = [item];
    const ids = [item.id];
    const validPostMoveOneUsingMultipleRequest = {
      ...request,
      method: HTTP_METHODS.POST,
      url: buildMultipleItemsUrl('/move', ids),
      params: {
        ...(request.params as object),
        id: ids,
      },
      query: {
        id: ids,
      },
    };

    const itemService = {
      get: jest.fn(async (id) => items.find(({ id: thisId }) => thisId === id)),
    } as unknown as ItemService;

    const savedActions = await itemActionHandler(itemService, {
      request: validPostMoveOneUsingMultipleRequest,
      reply,
      log,
      dbHandler: dbTransactionHandler,
    });

    expect(savedActions.length).toEqual(items.length);
    items.forEach((item, idx) => {
      checkActionData(savedActions[idx], {
        itemId: item.id,
        itemType: item.type,
        actionType: ACTION_TYPES.MOVE,
      });
    });
  });

  it('POST move multiple items', async () => {
    const items = [getDummyItem(), getDummyItem()];
    const ids = items.map((i) => i.id);
    const validPostMoveMultipleRequest = {
      ...request,
      method: HTTP_METHODS.POST,
      url: buildMultipleItemsUrl('/move', ids),
      params: {
        ...(request.params as object),
        id: ids,
      },
      query: {
        id: ids,
      },
    };

    const itemService = getMultipleItemService(items);

    const savedActions = await itemActionHandler(itemService, {
      request: validPostMoveMultipleRequest,
      reply,
      log,
      dbHandler: dbTransactionHandler,
    });

    expect(savedActions.length).toEqual(items.length);
    items.forEach((item, idx) => {
      checkActionData(savedActions[idx], {
        itemId: item.id,
        itemType: item.type,
        actionType: ACTION_TYPES.MOVE,
      });
    });
  });

  it('PATCH item', async () => {
    const validPatchRequest = {
      ...request,
      method: HTTP_METHODS.PATCH,
      url: `/items/${item.id}`,
      params: {
        ...(request.params as object),
        id: item.id,
      },
    };

    const savedActions = await itemActionHandler(itemService, {
      request: validPatchRequest,
      reply,
      log,
      dbHandler: dbTransactionHandler,
    });
    // should return array with an action
    expect(savedActions).not.toHaveLength(0);
    checkActionData(savedActions[0], {
      itemId: item.id,
      itemType: item.type,
      actionType: ACTION_TYPES.UPDATE,
    });
  });

  it('PATCH multiple items', async () => {
    const items = [getDummyItem(), getDummyItem()];
    const ids = items.map((i) => i.id);
    const validPatchMultipleRequest = {
      ...request,
      method: HTTP_METHODS.PATCH,
      url: buildMultipleItemsUrl('', ids),
      params: {
        ...(request.params as object),
        id: ids,
      },
      query: {
        id: ids,
      },
    };
    const itemService = getMultipleItemService(items);

    const savedActions = await itemActionHandler(itemService, {
      request: validPatchMultipleRequest,
      reply,
      log,
      dbHandler: dbTransactionHandler,
    });

    expect(savedActions.length).toEqual(items.length);
    items.forEach((item, idx) => {
      checkActionData(savedActions[idx], {
        itemId: item.id,
        itemType: item.type,
        actionType: ACTION_TYPES.UPDATE,
      });
    });
  });
});
