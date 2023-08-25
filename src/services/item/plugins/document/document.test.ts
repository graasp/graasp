import { ReasonPhrases, StatusCodes } from 'http-status-codes';

import { HttpMethod, ItemType, PermissionLevel } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../test/app';
import { MULTIPLE_ITEMS_LOADING_TIME } from '../../../../../test/constants';
import { ItemMembershipRepository } from '../../../itemMembership/repository';
import { saveItemAndMembership } from '../../../itemMembership/test/fixtures/memberships';
import { BOB, saveMember } from '../../../member/test/fixtures/members';
import { ItemRepository } from '../../repository';
import { expectItem, getDummyItem } from '../../test/fixtures/items';

// mock datasource
jest.mock('../../../../plugins/datasource');

const extra = {
  [ItemType.DOCUMENT]: {
    content: 'my text is here',
  },
};

describe('Document Item tests', () => {
  let app;
  let actor;

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    app.close();
  });

  describe('POST /items', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));

      const payload = getDummyItem({ type: ItemType.DOCUMENT, extra });

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/items',
        payload,
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Create successfully', async () => {
        const payload = getDummyItem({ type: ItemType.DOCUMENT, extra });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload,
        });

        // check response value
        const newItem = response.json();
        expectItem(newItem, payload);
        expect(response.statusCode).toBe(StatusCodes.OK);

        // check item exists in db
        const item = await ItemRepository.get(newItem.id);
        expectItem(item, payload);

        // a membership is created for this item
        const membership = await ItemMembershipRepository.findOneBy({ item: { id: newItem.id } });
        expect(membership?.permission).toEqual(PermissionLevel.Admin);
      });

      it('Fail to create if type does not match extra', async () => {
        const payload = getDummyItem({
          type: ItemType.LINK,
          extra: { [ItemType.DOCUMENT]: { content: 'content' } },
        });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if payload is invalid', async () => {
        const payload = getDummyItem({
          type: ItemType.DOCUMENT,
          extra: { [ItemType.FOLDER]: { content: 'content' } } as any,
        });

        const response = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });

      it('Fail to create if content of document is not defined', async () => {
        const payload1 = getDummyItem({
          type: ItemType.DOCUMENT,
          extra: { [ItemType.DOCUMENT]: {} } as any,
        });

        const response1 = await app.inject({
          method: HttpMethod.POST,
          url: '/items',
          payload: payload1,
        });

        expect(response1.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('PATCH /items/:id', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/items/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Update successfully', async () => {
        const { item } = await saveItemAndMembership({
          item: getDummyItem({
            type: ItemType.DOCUMENT,
            extra: {
              [ItemType.DOCUMENT]: {
                content: 'value',
              },
            },
          }),
          member: actor,
        });
        const payload = {
          name: 'new name',
          extra: {
            [ItemType.DOCUMENT]: {
              content: 'new value',
              // test that flavor can be updated
              flavor: 'info' as const,
            },
          },
          settings: {
            hasThumbnail: true,
            isCollapsible: true,
          },
        };

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items/${item.id}`,
          payload,
        });

        // this test a bit how we deal with extra: it replaces existing keys
        expectItem(response.json(), {
          ...item,
          ...payload,
          extra: { ...item.extra, ...payload.extra },
          settings: { ...item.settings, ...payload.settings },
        });

        expect(response.json().settings).toEqual(payload.settings);

        expect(response.statusCode).toBe(StatusCodes.OK);
      });

      it('Bad Request if extra is invalid', async () => {
        const { item } = await saveItemAndMembership({
          item: getDummyItem({
            type: ItemType.DOCUMENT,
            extra: {
              [ItemType.DOCUMENT]: {
                content: 'value',
              },
            },
          }),
          member: actor,
        });
        const payload = {
          name: 'new name',
          extra: {
            [ItemType.LINK]: {
              content: 'new value',
            },
          },
          settings: {
            someSetting: 'value',
          },
        };

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items/${item.id}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });

  describe('PATCH many /items', () => {
    it('Throws if signed out', async () => {
      ({ app } = await build({ member: null }));
      const member = await saveMember(BOB);
      const { item } = await saveItemAndMembership({ member });

      const response = await app.inject({
        method: HttpMethod.PATCH,
        url: `/items?id=${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
      });

      it('Update successfully', async () => {
        const { item } = await saveItemAndMembership({
          item: getDummyItem({
            type: ItemType.DOCUMENT,
            extra: {
              [ItemType.DOCUMENT]: {
                content: 'value',
              },
            },
          }),
          member: actor,
        });
        const payload = {
          name: 'new name',
          extra: {
            [ItemType.DOCUMENT]: {
              content: 'new value',
            },
          },
          settings: {
            hasThumbnail: true,
          },
        };

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items?id=${item.id}`,
          payload,
        });

        expect(response.statusCode).toBe(StatusCodes.ACCEPTED);
        await new Promise((res) => {
          setTimeout(async () => {
            const savedItem = await ItemRepository.get(item.id);
            // this test a bit how we deal with extra: it replaces existing keys
            expectItem(savedItem, {
              ...item,
              ...payload,
              extra: { ...item.extra, ...payload.extra },
            });
            res(true);
          }, MULTIPLE_ITEMS_LOADING_TIME);
        });
      });

      it('Bad Request if extra is invalid', async () => {
        const { item } = await saveItemAndMembership({
          item: getDummyItem({
            type: ItemType.DOCUMENT,
            extra: {
              [ItemType.DOCUMENT]: {
                content: 'value',
              },
            },
          }),
          member: actor,
        });
        const payload = {
          name: 'new name',
          extra: {
            [ItemType.LINK]: {
              content: 'new value',
            },
          },
          settings: {
            someSetting: 'value',
          },
        };

        const response = await app.inject({
          method: HttpMethod.PATCH,
          url: `/items?id=${item.id}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
