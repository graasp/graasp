import qs from 'qs';
import { v4 } from 'uuid';

import { FastifyLoggerInstance, FastifyReply, FastifyRequest } from 'fastify';

import { DatabaseTransactionHandler, HttpMethod, ItemService } from '@graasp/sdk';

import { getDummyItem } from '../../../../test/fixtures/items';
import { checkActionData } from '../../../../test/fixtures/utils';
import { GRAASP_ACTOR } from '../../../util/config';
import { ACTION_TYPES } from '../constants/constants';
import { itemActionHandler } from './item-action-handler';

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
const log = { debug: jest.fn() } as unknown as FastifyLoggerInstance;
const item = getDummyItem();
const itemService = getItemService(item);
const request = {
  url: `/items/${item.id}`,
  method: HttpMethod.GET,
  member: GRAASP_ACTOR,
  params: {},
  query: {},
  ip: '',
  headers: {},
} as unknown as FastifyRequest;

describe('Create Action Task', () => {
  it('returns empty actions array if request does not match any path', async () => {
    const invalidUrlRequest = {
      ...request,
      method: HttpMethod.GET,
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
      method: HttpMethod.GET,
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
      method: HttpMethod.GET,
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
      method: HttpMethod.POST,
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
      method: HttpMethod.POST,
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
      method: HttpMethod.POST,
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
      method: HttpMethod.POST,
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
      method: HttpMethod.POST,
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
      method: HttpMethod.POST,
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
      method: HttpMethod.PATCH,
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
      method: HttpMethod.PATCH,
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
