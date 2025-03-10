import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { v4 } from 'uuid';
import waitForExpect from 'wait-for-expect';

import { FastifyInstance } from 'fastify';

import { HttpMethod, ItemType, PermissionLevel, ShortcutItemFactory } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { resolveDependency } from '../../../../di/utils';
import { Item } from '../../../../drizzle/types';
import { MemberCannotAccess, MemberCannotWriteItem } from '../../../../utils/errors';
import { saveMember } from '../../../member/test/fixtures/members';
import { ItemService } from '../../service';
import { ItemTestUtils, expectItem } from '../../test/fixtures/items';
import { ActionItemService } from '../action/action.service';

const itemMembershipRawRepository = AppDataSource.getRepository(ItemMembership);
const testUtils = new ItemTestUtils();

describe('Shortcut routes tests', () => {
  let app: FastifyInstance;
  let actor;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
    actor = null;
  });
  describe('POST /items/shortcuts', () => {
    it('Throws if signed out', async () => {
      const response = await app.inject({
        method: HttpMethod.Post,
        url: '/items/shortcuts',
        payload: { target: v4() },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      let waitForPostCreation: () => Promise<unknown>;
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);

        const itemService = resolveDependency(ItemService);
        const actionItemService = resolveDependency(ActionItemService);

        const itemServiceRescaleOrderForParent = jest.spyOn(itemService, 'rescaleOrderForParent');
        const actionItemServicePostPostAction = jest.spyOn(actionItemService, 'postPostAction');

        // The API's is still working with the database after responding to an item post request,
        // so we need to wait for the work to be done so we don't have flacky deadlock exceptions.
        waitForPostCreation = async () => {
          return await waitForExpect(async () => {
            expect(itemServiceRescaleOrderForParent).toHaveBeenCalled();
            expect(actionItemServicePostPostAction).toHaveBeenCalled();
          });
        };
      });

      it('Create successfully', async () => {
        const { item: target } = await testUtils.saveItemAndMembership({ member: actor });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/shortcuts',
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
        const item = await testUtils.itemRepository.getOne(app.db, newItem.id);
        expect(item?.id).toEqual(newItem.id);

        // a membership is created for this item
        const membership = await itemMembershipRawRepository.findOneBy({
          item: { id: newItem.id },
        });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);

        // order is null for root
        expect(await testUtils.getOrderForItemId(newItem.id)).toBeNull();
      });

      it('Create without name', async () => {
        const { item: target } = await testUtils.saveItemAndMembership({ member: actor });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/shortcuts',
          payload: { target: target.id },
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.OK);
        expect(response.json().type).toEqual(ItemType.SHORTCUT);
      });

      it('Bad request if name is invalid', async () => {
        // by default the item creator use an invalid item type
        const newItem = ShortcutItemFactory({ name: '' });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: '/items/shortcuts',
          payload: newItem,
        });
        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);

        // by default the item creator use an invalid item type
        const newItem1 = ShortcutItemFactory({ name: ' ' });
        const response1 = await app.inject({
          method: HttpMethod.Post,
          url: '/items/shortcuts',
          payload: newItem1,
        });
        expect(response1.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if parentId id is invalid', async () => {
        const payload = ShortcutItemFactory();
        const parentId = 'invalid-id';
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/shortcuts?parentId=${parentId}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if target id is invalid', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `/items/shortcuts`,
          payload: { target: 'target' },
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('PATCH /items/shortcuts/:id', () => {
    it('Throws if signed out', async () => {
      const member = await saveMember();
      const { item } = await testUtils.saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/items/shortcuts/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        actor = await saveMember();
        mockAuthenticate(actor);
      });

      it('Update successfully', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          item: {
            type: ItemType.SHORTCUT,
            extra: {
              [ItemType.SHORTCUT]: { target: v4() },
            },
          },
          member: actor,
        });
        const payload = {
          name: 'new name',
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/shortcuts/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        expectItem(response.json(), {
          ...item,
          ...payload,
        });
      });

      it('Does not apply update for settings', async () => {
        const { item } = await testUtils.saveItemAndMembership({
          item: {
            type: ItemType.SHORTCUT,
            extra: {
              [ItemType.SHORTCUT]: { target: v4() },
            },
            settings: { isCollapsible: false },
          },
          member: actor,
        });
        const payload = {
          settings: { isCollapsible: true },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/shortcuts/${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.OK);

        const newItem = response.json();
        expect(newItem.settings.isCollapsible).toBe(false);
        expectItem(newItem, item);
      });

      it('Bad request if id is invalid', async () => {
        const payload = {
          name: 'new name',
        };
        const response = await app.inject({
          method: HttpMethod.Patch,
          url: '/items/shortcuts/invalid-id',
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Cannot update item if does not have membership', async () => {
        const payload = {
          name: 'new name',
        };
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });
        const shortcut = await testUtils.saveItem({
          item: ShortcutItemFactory() as unknown as Item,
          parentItem: item,
        });

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/shortcuts/${shortcut.id}`,
          payload,
        });

        expect(response.json()).toEqual(new MemberCannotAccess(shortcut.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
      it('Cannot update item if has only read membership', async () => {
        const payload = {
          name: 'new name',
        };
        const member = await saveMember();
        const { item } = await testUtils.saveItemAndMembership({ member });
        const shortcut = await testUtils.saveItem({
          item: ShortcutItemFactory() as unknown as Item,
          parentItem: item,
        });
        await testUtils.saveMembership({
          item: shortcut,
          account: actor,
          permission: PermissionLevel.Read,
        });

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/items/shortcuts/${shortcut.id}`,
          payload,
        });

        expect(response.json()).toEqual(new MemberCannotWriteItem(shortcut.id));
        expect(response.statusCode).toBe(StatusCodes.FORBIDDEN);
      });
    });
  });
});
