import { eq } from 'drizzle-orm';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, PermissionLevel, ShortcutItemFactory } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { resolveDependency } from '../../../../di/utils';
import { db } from '../../../../drizzle/db';
import { itemMembershipsTable, itemsRawTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';
import { MemberCannotAccess, MemberCannotWriteItem } from '../../../../utils/errors';
import { ItemService } from '../../item.service';
import { expectItem } from '../../test/fixtures/items';
import { ItemActionService } from '../action/itemAction.service';

describe('Shortcut routes tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('POST /items/shortcuts', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/api/items/shortcuts',
        payload: { target: v4() },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let waitForPostCreation: () => Promise<unknown>;
      beforeEach(async () => {
        const itemService = resolveDependency(ItemService);
        const itemActionService = resolveDependency(ItemActionService);

        const itemServiceRescaleOrderForParent = jest.spyOn(itemService, 'rescaleOrderForParent');
        const itemActionServicePostPostAction = jest.spyOn(itemActionService, 'postPostAction');

        // The API's is still working with the database after responding to an item post request,
        // so we need to wait for the work to be done so we don't have flacky deadlock exceptions.
        waitForPostCreation = async () => {
          return await waitForExpect(async () => {
            expect(itemServiceRescaleOrderForParent).toHaveBeenCalled();
            expect(itemActionServicePostPostAction).toHaveBeenCalled();
          });
        };
      });

      it('Create successfully', async () => {
        const {
          actor,
          items: [target],
        } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/shortcuts',
          payload: { target: target.id, name: 'name' },
        });
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check response value
        const newItem = response.json();
        expect(newItem.name).toEqual('name');
        expect(newItem.type).toEqual(ItemType.SHORTCUT);
        expect(newItem.extra.shortcut.target).toEqual(target.id);
        await waitForPostCreation();

        // check item exists in db
        const item = await db.query.itemsRawTable.findFirst({
          where: eq(itemsRawTable.id, newItem.id),
        });
        expect(item?.id).toEqual(newItem.id);
        // order is null for root
        expect(item?.order).toBeNull();

        // a membership is created for this item
        const membership = await db.query.itemMembershipsTable.findFirst({
          where: eq(itemMembershipsTable.itemPath, newItem.path),
        });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);
      });

      it('Create without name', async () => {
        const {
          actor,
          items: [target],
        } = await seedFromJson({ items: [{ memberships: [{ account: 'actor' }] }] });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/shortcuts',
          payload: { target: target.id },
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.OK);
        expect(response.json().type).toEqual(ItemType.SHORTCUT);
      });

      it('Bad request if name is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        // by default the item creator use an invalid item type
        const newItem = ShortcutItemFactory({ name: '' });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/shortcuts',
          payload: newItem,
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

        // by default the item creator use an invalid item type
        const newItem1 = ShortcutItemFactory({ name: ' ' });
        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: '/api/items/shortcuts',
          payload: newItem1,
        });
        expect(response1.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if parentId id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = ShortcutItemFactory();
        const parentId = 'invalid-id';
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/shortcuts?parentId=${parentId}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if target id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/api/items/shortcuts`,
          payload: { target: 'target' },
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('PATCH /items/shortcuts/:id', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ actor: null, items: [{}] });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/api/items/shortcuts/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Update successfully', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              type: ItemType.SHORTCUT,
              extra: {
                [ItemType.SHORTCUT]: { target: v4() },
              },
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/shortcuts/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        expectItem(response.json(), {
          ...item,
          ...payload,
        });
      });

      it('Does not apply update for settings', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              type: ItemType.SHORTCUT,
              extra: {
                [ItemType.SHORTCUT]: { target: v4() },
              },
              settings: { isCollapsible: false },
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          settings: { isCollapsible: true },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/shortcuts/${item.id}`,
          payload,
        });
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

        const newItem = await db.query.itemsRawTable.findFirst({
          where: eq(itemsRawTable.id, item.id),
        });
        assertIsDefined(newItem);
        expect(newItem.settings.isCollapsible).toBe(false);
        expectItem(newItem, item);
      });

      it('Bad request if id is invalid', async () => {
        const { actor } = await seedFromJson();
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: '/api/items/shortcuts/invalid-id',
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Cannot update item if does not have membership', async () => {
        const {
          actor,
          items: [shortcut],
        } = await seedFromJson({
          items: [
            {
              type: ItemType.SHORTCUT,
              extra: {
                [ItemType.SHORTCUT]: { target: v4() },
              },
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/shortcuts/${shortcut.id}`,
          payload,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(shortcut.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
      it('Cannot update item if has only read membership', async () => {
        const {
          actor,
          items: [shortcut],
        } = await seedFromJson({
          items: [
            {
              type: ItemType.SHORTCUT,
              extra: {
                [ItemType.SHORTCUT]: { target: v4() },
              },
              settings: { isCollapsible: false },
              memberships: [{ account: 'actor', permission: PermissionLevel.Read }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/shortcuts/${shortcut.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
        expect(response.json().message).toEqual(new MemberCannotWriteItem(shortcut.id).message);
      });
    });
  });
});
